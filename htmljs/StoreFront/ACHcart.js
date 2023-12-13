async function AVICapiData(endpoint, data=null, method="GET") {
    var opts = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value
        }
    }
    if (data != null) {opts["body"] = JSON.stringify(data); }
    const response = await fetch(endpoint, opts);
    return await response.json();
}

function createOrderLine(itemData) {
    return {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderLineData, Asi.Contracts", 
        "OrderLineId": self.crypto.randomUUID(),
        "Item": itemData, 
        "QuantityOrdered": {
            "$type": "System.Nullable`1[[Asi.Soa.Commerce.DataContracts.QuantityData, Asi.Contracts]], mscorlib", 
            "Amount": 1
        },
        "LineNumber": 1,
        "SourceCode": "",
        "CanCombine": true,
    }
}

function getBillingAddress(user) {
    for (address of user["Addresses"]["$values"]) {
        if (address["AddressPurpose"] == "Billing") {
            return address;
        }
    }
    return null;
}

async function AVICcreateCart(uid) {
    // get user info, OrgID and Billing Address
    const user = await AVICapiData(`/api/Person/${uid}`);
    var bid = user["PrimaryOrganization"]["OrganizationPartyId"];
    if (bid == undefined) { bid = uid; }
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
                    "PartyId": bid
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

async function AVICgetOrCreateCart() {
    var uid = JSON.parse(document.getElementById("__ClientContext").value)["loggedInPartyId"];
    const result = await AVICapiData(`/api/Cart?UserId=${uid}&UpdatedBy=${uid}`);
    cart = null;
    if (result["Items"]["$values"].length < 1) {
        cart = await AVICcreateCart(uid);
    } else {
        cart = result["Items"]["$values"][0];
    }
    return cart;
}

async function AVICaddToCart(productID) {
    // get cart
    var cart = await AVICgetOrCreateCart();
    // get item
    const itemresult = await AVICapiData(`/api/Item/${productID}`);
    var order = cart["ComboOrder"]["Order"];
    // append to order
    order["Lines"]["$values"].push(createOrderLine(itemresult));
    // update pricing
    order = await AVICapiData("/api/Order/_execute", {
        "$type": "Asi.Soa.Commerce.DataContracts.OrderPriceUpdateRequest, Asi.Contracts",
        "EntityTypeName": "Order",
        "OperationName": "UpdatePricing",
        "Order": order
    }, "POST");
    // replace order data in cart with above
    cart["ComboOrder"]["Order"] = order;
    // PUT cart update
    await AVICapiData(`/api/cart/${cart["CartId"]}`, cart, "PUT");
}