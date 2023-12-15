// <script src="/common/Uploaded%20files/Code/storefront/modifyProductList.js"></script>
async function AVICModifyProdListButtons() {
    const udata = JSON.parse(document.getElementById("__ClientContext").value);
    for (const elem of document.querySelectorAll('tr[id*="ciProductList"][role="row"]')) {
        if (elem.children.length == 2) {
            const prodcode = elem.children[1].innerHTML;
            if (prodcode != undefined && prodcode != "") {
                const button = elem.querySelector("input[type=button]");
                if (button == null) { continue; }
                while (button.previousElementSibling != null) { button.previousElementSibling.remove(); } // remove quantity
                if (udata["isAnonymous"]) {
                    const newbutton = document.createElement("a");
                    //'<a class="TextButton PrimaryButton" href="/achper/signin">Log in</a>'
                    newbutton.classList = "TextButton PrimaryButton";
                    newbutton.href = `/achper/signin?LoginRedirect=true&returnurl=${window.location.pathname}${window.location.hash}`;
                    newbutton.innerHTML = "Log in";
                    button.after(newbutton);
                    button.remove();
                } else {
                    button.value = "View product";
                    button.onclick = async (e) => {
                        const ir = await AVICapiData(`/api/ItemSummary/${prodcode}`);
                        var cat = "";
                        if (ir.hasOwnProperty("ItemClass") && ir["ItemClass"].hasOwnProperty("ItemClassId") && 
                                ir["ItemClass"]["ItemClassId"].startsWith("SALES-") ) {
                            cat = ir["ItemClass"]["ItemClassId"].slice(6);
                        }
                        const params = new URLSearchParams({"iProductCode": prodcode, "Category": cat, 
                            "prev": window.location.pathname, "h": window.location.hash.slice(1) });
                        window.location.href = `/ItemDetail?${params.toString()}`; 
                    }
                    if (new URLSearchParams(window.location.search).getAll("c").includes(prodcode)) {
                        button.value = button.value + ' \u2713';
                        button.disabled = true;
                    }
                }
            }
        }
    }
}
window.addEventListener("DOMContentLoaded", AVICModifyProdListButtons);