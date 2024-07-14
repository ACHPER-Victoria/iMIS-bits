// Paste the following in to the browser dev console. To attempt to add an item to cart, call:
// AVICaddToCart(productID);
// In the dev console.
// You may end up making broken carts or want to clear your cart. There is a helper function:
// AVICpurgeCart();
// you can use to clear the cart of the logged in user.

async function AVICapiData(endpoint, data=null, method="GET") {
    var opts = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value
        }
    }
    if (data != null) { opts["body"] = JSON.stringify(data); }
    const response = await fetch(endpoint, opts);
    return await response.json();
}

// await AVICpurgeCart(); to purge existing cart for the currently logged in user.
async function AVICpurgeCart() {
    const uid = JSON.parse(document.getElementById("__ClientContext").value)["loggedInPartyId"];
    const result = await AVICapiData(`/api/Cart?UserId=${uid}&UpdatedBy=${uid}`);
    if (result["Items"]["$values"].length > 0) {
        await AVICapiData(`/api/cart/${result["Items"]["$values"][0]["CartId"] }`, null, "DELETE");
    }
}

function createOrderLine(itemData, lineno) {
    return {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderLineData, Asi.Contracts", 
        "OrderLineId": self.crypto.randomUUID(),
        "Item": itemData, 
        "QuantityOrdered": {
            "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib", 
            "Amount": 1
        },
        "LineNumber": lineno,
        "SourceCode": "",
        "CanCombine": true,
        "UsesPriceGroup" : true
    }
}

async function AVICcreateCart(uid, oid=null) {
    const cartpost = {
        "$type": "Asi.Soa.Commerce.DataContracts.CartData, Asi.Contracts",
        "UserId": uid,
        "ComboOrder": {
            "$type": "Asi.Soa.Commerce.DataContracts.ComboOrderData, Asi.Contracts",
            "Order": {
                "$type": "Asi.Soa.Commerce.DataContracts.OrderData, Asi.Contracts",
                "Lines": {
                    "$type": "Asi.Soa.Commerce.DataContracts.OrderLineDataCollection, Asi.Contracts",
                    "$values": []
                },
                "SoldToCustomerParty": {
                    "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts", 
                    "PartyId": uid
                },
                "BillToCustomerParty": {
                    "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts", 
                    "PartyId": oid !== null ? oid : uid
                },
                "OriginatorCustomerParty": {
                    "$type": "Asi.Soa.Commerce.DataContracts.CustomerPartyData, Asi.Contracts",
                    "PartyId": uid
                },
                "Currency": {
                    "$type": "Asi.Soa.Core.DataContracts.CurrencyData, Asi.Contracts",
                    "CurrencyCode": "AUD",
                    "DecimalPositions": 2
                },
                "SourceCode": ""
            },
            "Currency": {
                "$type": "Asi.Soa.Core.DataContracts.CurrencyData, Asi.Contracts",
                "CurrencyCode": "AUD",
                "DecimalPositions": 2
            },
        },
        "UpdateInformation": {
            "$type": "Asi.Soa.Core.DataContracts.EntityUpdateInformationData, Asi.Contracts",
            "CreatedBy": uid,
            "CreatedOn": new Date().toISOString(),
            "UpdatedBy": uid,
            "UpdatedOn": new Date().toISOString()
        }
    };
    return await AVICapiData("/api/cart", cartpost, "POST");
}

async function AVICgetOrCreateCart(uid) {
    const result = await AVICapiData(`/api/Cart?UserId=${uid}&UpdatedBy=${uid}`);
    cart = null;
    if (result["Items"]["$values"].length < 1) {
        const user = await AVICapiData(`/api/Person/${uid}`);
        cart = await AVICcreateCart(uid, user["PrimaryOrganization"]["OrganizationPartyId"]);
    } else {
        cart = result["Items"]["$values"][0];
    }
    return cart;
}

async function AVICchangeBillToOrg(uid, order) {
    // get user info, OrgID
    const user = await AVICapiData(`/api/Person/${uid}`);
    var oid = user["PrimaryOrganization"]["OrganizationPartyId"];
    if (oid == undefined) { return order; }
    order["BillToCustomerParty"]["PartyId"] = oid;
    order = await AVICapiData("/api/Order/_execute", {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderPriceUpdateRequest, Asi.Contracts",
        "EntityTypeName": "Order",
        "OperationName": "UpdatePricing",
        "Order": order
    }, "POST");
    return order;
}

async function AVICpurgeCart() {
    const uid = JSON.parse(document.getElementById("__ClientContext").value)["loggedInPartyId"];
    const result = await AVICapiData(`/api/Cart?UserId=${uid}&UpdatedBy=${uid}`);
    if (result["Items"]["$values"].length > 0) {
        await AVICapiData(`/api/cart/${result["Items"]["$values"][0]["CartId"] }`, null, "DELETE");
    }
}

async function AVICaddToCart(productID) {
    const uid = JSON.parse(document.getElementById("__ClientContext").value)["loggedInPartyId"];
    // get cart
    var cart = await AVICgetOrCreateCart(uid);
    // get item
    const itemresult = await AVICapiData(`/api/ItemSummary/${productID}`);
    var order = cart["ComboOrder"]["Order"];
    // append to order
    const orderlines = order["Lines"]["$values"].length;
    order["Lines"]["$values"].push(createOrderLine(itemresult, orderlines+1));
    // update pricing
    order = await AVICapiData("/api/Order/_execute", {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderPriceUpdateRequest, Asi.Contracts",
        "EntityTypeName": "Order",
        "OperationName": "UpdatePricing",
        "Order": order
    }, "POST");
    //post... again, since the first post doesn't get correct pricing.
    order = await AVICapiData("/api/Order/_execute", {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderPriceUpdateRequest, Asi.Contracts",
        "EntityTypeName": "Order",
        "OperationName": "UpdatePricing",
        "Order": order
    }, "POST");
    
    // replace order data in cart with above
    cart["ComboOrder"]["Order"] = order;
    await AVICapiData(`/api/cart/${cart["CartId"]}`, cart, "PUT");
    // get updated cart to attempt to change billto orgid
    cart = await AVICgetOrCreateCart(uid);
    order = cart["ComboOrder"]["Order"];
    //order = await AVICchangeBillToOrg(uid, order); // change bill to user to bill to org
    // replace order data in cart with above
    cart["ComboOrder"]["Order"] = order;
    await AVICapiData(`/api/cart/${cart["CartId"]}`, cart, "PUT");
}