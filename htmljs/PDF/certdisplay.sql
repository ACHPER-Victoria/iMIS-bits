'<a class="TextButton" href="/user-downloads/certificate-generation/DownloadCertificate.aspx?EventKey=' + vBoCsEvent.EventCode + '&ProdCode=' + vBoACH_OrderLine_Attend.PRODUCT_CODE +'">Download</a>'

/* Staff */
'<a class="TextButton" href="/user-downloads/certificate-generation/DownloadCertificate.aspx?EventKey=' + vBoCsEvent.EventCode + '&ProdCode=' + vBoACH_OrderLine_Attend.PRODUCT_CODE + '&UID='+ vBoCsRegistration.ShipToId + '">Download</a>'

CASE vBoCsFunction.IsEventRegistrationOption WHEN 1 THEN vBoCsEvent.Title WHEN 0 THEN CONCAT(vBoCsEvent.Title, ' - ', vBoCsFunction.Title) END
