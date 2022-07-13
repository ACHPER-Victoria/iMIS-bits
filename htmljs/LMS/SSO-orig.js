<script type='text/javascript'>

jQuery(document).ready(function(){

    if (!String.prototype.includes) {
        String.prototype.includes = function (search, start) {
            'use strict'

            if (search instanceof RegExp) {
                throw TypeError('first argument must not be a RegExp')
            }
            if (start === undefined) { start = 0 }
            return this.indexOf(search, start) !== -1
        };
  }

/****************************************************************************************************/
/* ATS - Association Technology Solutions                                                           */
/* This may not be copied, used, or redistribted without the expressed written consent of ATS       */
/*info@atsol.org - www.atsol.org                                                                    */
/* Copyright 2020                                                                                   */
/****************************************************************************************************/

/****************************************************************************************************/
/* ATS Settings                                                                                     */
/****************************************************************************************************/

    /* Debug mode. set to true for testing only. For production it should be false. This will allow you to have the system pause  each step of the way */
    const debugMode = false;

    /* Login Redirect Page url */
    var loginRedirectUrl = '/SignIn?LoginRedirect=true&returnurl=';

    /* url to the ATS webservice */
    var ATSWebServiceUrl = 'https://achper.atsservices.net/wsmoodle.asmx';

   /* This is the list of valid domain names that the server will return tokens to. This is a comma delimited list and the domain in the return url must end in one of these domains.*/
   var REDIRECTDOMAINS = "achper,atsol.org,moodle.com,learnbook.com.au";

/****************************************************************************************************/
/* ATS Settings                                                                                     */
/****************************************************************************************************/
    /* Do not edit anything below this line                               */
    /* ------------------------------------------------------------------ */

    /* Prepend gWebRoot to some variables */
    loginRedirectUrl = gWebRoot + loginRedirectUrl;
    var getUserNamePath = gWebRoot + '/asicommon/services/Membership/MembershipWebService.asmx/GetUserName';
    var getIDforUsernamePath = gWebRoot + '/api/CsWebUser/?UserId=';
    var currentPageUrl = window.location.href.substring(window.location.href.indexOf(window.location.hostname) + window.location.hostname.length, window.location.href.length);

    var gUserId = '';
    var gEncryptedUserId = '';
    var gUsername = '';
    var ssoNotAuthUrl = '';
    var ssoFilter = '';
    var ssoCourseIDParam = '';
    var courseURL = '';
    var cookieName = '';
    var cookieDomain = '';
    var ssoGatewayUrlParam = '';

    /* See if the user is logged in - WE CAN'T CALL REST AT ALL IF NOT! */
    if (debugMode) console.log('Step 1: Check if user is logged in, and get the username.');
    getUsername();

function getUsername() {
       if (debugMode) console.log('Making call to ASI membership webservice at ' + getUserNamePath);
        jQuery.ajax(getUserNamePath, {
            type: 'post',
            contentType: 'application/x-www-form-urlencoded',
            success: processUsername,
            error: function (jqXHR, textStatus, errorThrown) {
                if (debugMode) {
                    console.log('Encountered error getting current user\'s username.');
                    console.log('Error: ' + errorThrown); // Error returned
                    console.log(textStatus); // Request Status in plain text
                    console.log(jqXHR.status); // HTTP Status Code
                    console.log('Error calling ' + getUserNamePath);
                }
            }
        });
    }

function processUsername(data, status, req, xml, xmlHttpRequest, responseXML) {
    if (debugMode) console.log('Got success response from call to get current user\'s username.');

    var result = req.responseXML.firstChild;

    if (result !== undefined && result.innerHTML !== undefined && result.innerHTML !== '') {
        /* Firefox and Chrome (and possibly early versions of IE) */
        gUsername = result.innerHTML;
    } else if (result !== undefined && result.textContent !== undefined && result.textContent !== '') {
        /* At least IE 11 doesn't see innerHTML, but does have textContent */
        gUsername = result.textContent;
    }

    if (gUsername !== undefined && gUsername !== '') {
        /* User is logged in and we have the username. Move on to get the ID from the username. */
        if (debugMode) {
            console.log('Current user\'s username is \'' + gUsername + '\'.');
            console.log('Step 2: Get the bridge settings.');
        }
        getBridgeSettings();
    } else {
        /* User is not logged in - redirect to login */
        if (debugMode) console.log('No valid result from call to get current user\'s username - redirecting to login.');
        window.location = (loginRedirectUrl + encodeURIComponent(currentPageUrl));
    }
}

function getBridgeSettings() {
    jQuery.ajax(ATSWebServiceUrl + '/GetBridgeSettings', {
        type: 'get',
        contentType: 'application/x-www-form-urlencoded',
        success: processBridgeSettings,
        error: function (jqXHR, textStatus, errorThrown) {
            if (debugMode) {
                console.log('Encountered error getting SSO Information for the user ID ' + gUserId + '.');
                console.log('Error: ' + errorThrown); // Error returned
                console.log(textStatus); // Request Status in plain text
                console.log(jqXHR.status); // HTTP Status Code
                console.log('Failed to load GetSSOInformation.');
            }
        }
    });

    }

function processBridgeSettings(data, status, req, xml, xmlHttpRequest, responseXML) {
    if (debugMode) {
        console.log('Got success response from IQA. Returned settings data:');
        console.log(data);
    }

    /* Use the returned JSON settings data to set the appropriate variables */
    var INCOMING_URL_PARAM = '';

    /* Firefox and Chrome (and possibly early versions of IE) */
    var bridgeSettings = data.documentElement.children;
    if (typeof(bridgeSettings) === "undefined") {
        /* At least IE 11 doesn't see innerHTML, but does have textContent */
        bridgeSettings = data.documentElement.childNodes;
    }


    for (var i = 0; i < bridgeSettings.length; i++) {
        var settingName = bridgeSettings[i].nodeName.toUpperCase();
        var settingValue;

        if (typeof(req.responseXML.children) !== "undefined") {
            /* Firefox and Chrome (and possibly early versions of IE) */
            settingValue = bridgeSettings[i].innerHTML;
        } else {
            /* At least IE 11 doesn't see innerHTML, but does have textContent */
            settingValue = bridgeSettings[i].textContent;
        }


        if (debugMode) {
            console.log('i is ' + i + '.');
            console.log('bridgeSettings[i]' + settingName );
            console.log('bridgeSettings[i]' + settingValue );
        }

        if (settingName === 'SSOGATEWAYURLPARAM') {
            ssoGatewayUrlParam = settingValue;
        } else if (settingName === 'SSOFILTER') {
            ssoFilter = settingValue;
        } else if (settingName === 'SSOCOURSEIDPARAM') {
            ssoCourseIDParam = settingValue;
        } else if (settingName === 'COURSEURL') {
            courseURL = settingValue;
        } else if (settingName === 'COOKIENAME') {
            cookieName = settingValue;
        } else if (settingName === 'COOKIEDOMAIN') {
            cookieDomain = settingValue;
        } else if (settingName === 'SSONOTAUTHORIZEDURL') {
            ssoNotAuthUrl = settingValue;
        }
    }

    if (debugMode) console.log('Step 3: Get the user\'s iMIS ID from CsWebUser.');
    getUserId();
}

function getUserId() {
        jQuery.ajax(getIDforUsernamePath + gUsername, {
            type: 'get',
            contentType: 'application/json',
            headers: {
                'RequestVerificationToken': jQuery('#__RequestVerificationToken').val()
            },
            success: processUserId,
            error: function (jqXHR, textStatus, errorThrown) {
                if (debugMode) {
                    console.log('Encountered error getting iMIS ID from the REST API.');
                    console.log('Error: ' + errorThrown); // Error returned
                    console.log(textStatus); // Request Status in plain text
                    console.log(jqXHR.status); // HTTP Status Code
                    console.log('Error calling ' + getIDforUsernamePath + gUsername);
                }
            }
        });
    }

function processUserId(data, status, req, xml, xmlHttpRequest, responseXML) {
    if (debugMode) {
        console.log('Parsing User ID from returned JSON object.');
        console.log(data);
    }

    var contactProperties;

    if (typeof(data.Items.$values) !== "undefined") {
        /* iMIS 20.2.46+ */
        contactProperties = data.Items.$values[0].Properties.$values;
    } else {
        /* iMIS versions prior to 20.2.46 */
        contactProperties = data.Items[0].Properties;
    }

    for (var i = 0; i <= contactProperties.length; i++) {
        if (contactProperties[i].Name == "ID") {
            gUserId = contactProperties[i].Value;
            break;
        }
    }

    /* We have the user ID. Now we can get the token. */
    if (debugMode) {
        console.log('Current user\s iMIS ID is ' + gUserId + '.');
        console.log('Step 4: Get the token for the user\'s ID.');
    }

    if(ssoFilter !== null && ssoFilter !== '') {
        checkSSOFilter();
    } else {
        encryptUserID();
    }
}

function checkSSOFilter() {
    jQuery.ajax(ATSWebServiceUrl + '/checkSSOFilter?id=' + gUserId, {
        type: 'get',
        contentType: 'application/x-www-form-urlencoded',
        success: processCheckSSOFilter,
        error: function (jqXHR, textStatus, errorThrown) {
            if (debugMode) {
                console.log('Encountered error getting SSO Information for the user ID ' + gUserId + '.');
                console.log('Error: ' + errorThrown); // Error returned
                console.log(textStatus); // Request Status in plain text
                console.log(jqXHR.status); // HTTP Status Code
                console.log('Failed to load GetSSOInformation.');
            }
        }
    });
}

function processCheckSSOFilter(data, status, req, xml, xmlHttpRequest, responseXML) {
    if (debugMode) {
        console.log('Got success response from call to get the CheckSSOFilter for the user\'s ID.');
        console.log(data);
    }

    var kvpName = [];
    var kvpValue = [];

    var numChildeNodes = req.responseXML.firstChild.childNodes.length;

    var resultCode = null;
    var resultMessage = null;
    var isAllowed = null;

    for (i = 0; i < numChildeNodes; i++) {


        if (req.responseXML.firstChild.childNodes[i].nodeName == "ResultCode") {

            if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== '') {
                resultCode = req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML;
            } else if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== '') {
                resultCode = req.responseXML.firstChild.childNodes[i].childNodes[0].textContent;
            }

        }

        else if (req.responseXML.firstChild.childNodes[i].nodeName == "isAllowed") {

            if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== '') {
                isAllowed = req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML;
            } else if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== '') {
                isAllowed = req.responseXML.firstChild.childNodes[i].childNodes[0].textContent;
            }

        }

        else if (req.responseXML.firstChild.childNodes[i].nodeName == "ResultMessage") {

            if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML !== '') {
                resultMessage = req.responseXML.firstChild.childNodes[i].childNodes[0].innerHTML;
            } else if (req.responseXML.firstChild.childNodes[i].childNodes[0] !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== undefined && req.responseXML.firstChild.childNodes[i].childNodes[0].textContent !== '') {
                resultMessage = req.responseXML.firstChild.childNodes[i].childNodes[0].textContent;
            }

        }

    }

    if(resultCode !== "0")
    {
        if (debugMode) {
            console.log("Error checking SSO filter for the user ID " + gUserId + '; Error:' + objSSOFilterResults.ResultMessage );
        }
    }
    else
    {
        if (isAllowed !== "1" && isAllowed !== "true" && isAllowed !== "True") {
            console.log("Error checking SSO filter for the user ID " + gUserId + '; Error:' + objSSOFilterResults.ResultMessage );

            window.location.replace(ssoNotAuthUrl);
        }
        else
        {
            encryptUserID();
        }
    }

}

function encryptUserID() {

    jQuery.ajax(ATSWebServiceUrl + '/getToken?id=' + gUserId, {
        type: 'get',
        contentType: 'application/x-www-form-urlencoded',
        success: processEncryptUserID,
        error: function (jqXHR, textStatus, errorThrown) {
            if (debugMode) {
                console.log('Encountered error encrypting the user ID ' + gUserId + '.');
                console.log('Error: ' + errorThrown); // Error returned
                console.log(textStatus); // Request Status in plain text
                console.log(jqXHR.status); // HTTP Status Code
                console.log('Failed to load asiEncrypt.');
            }
        }
    });

}

function processEncryptUserID(data, status, req, xml, xmlHttpRequest, responseXML) {

    if (typeof(req.responseXML.children) !== "undefined") {
        /* Firefox and Chrome (and possibly early versions of IE) */
        gEncryptedUserId = req.responseXML.children[0].innerHTML;
    } else {
        /* At least IE 11 doesn't see innerHTML, but does have textContent */
        gEncryptedUserId = req.responseXML.firstChild.textContent;
    }

    if (debugMode) {
        console.log('gEncryptedUserId =' + gEncryptedUserId + '.');
    }

    ATScreateCookie();
}

function ATScreateCookie() {
    //Create the cookie
    var myDate = new Date();
    myDate.setMonth(myDate.getMonth() + 12);

    var cookieString = cookieName + "=" + gEncryptedUserId + ";expires=" + myDate;
    if(cookieDomain !== null && cookieDomain !== '') {
        cookieString = cookieString + ";domain=" + cookieDomain;
    }

    document.cookie = cookieString;

    processUserRedirect();
}

function processUserRedirect() {
    courseId = getParameterByName(ssoCourseIDParam);

    if(courseId === null || courseId === '')
    {
        //This is an error
        if (debugMode) {
            console.log('No Course ID was specified');
        }
    }

    redirectURL = courseURL + courseId;

    if (!redirectURL.includes('?'))
    {
        redirectURL = redirectURL + "?";
    }
    else
    {
        redirectURL = redirectURL + "&";
    }

    redirectURL = redirectURL + ssoGatewayUrlParam + "=" + encodeURI(gEncryptedUserId);

        /* Validate the return domain */
        if (isValidRedirectDomain(redirectURL ))
        {
            if (debugMode) console.log('Redirecting user to ' + redirectURL + '.');
            window.location = redirectURL ;
        }
        else
        {
            alert("Unauthorized redirect");
        }
}


function getParameterByName(name, url) {
    if (!url) url = window.location.href;
            name = name.replace(/[\[\]]/g, '\\$&');
            if (debugMode) console.log('Parameter Name =  ' + name);
            if (debugMode) console.log('URL =  ' + url);
            var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)',"i"),
                results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            return decodeURIComponent(results[2].replace(/\+/g, ' '));
        }


function isValidRedirectDomain(url)
{
    /* If the variable is blank, don't check for restrictions */
    if (REDIRECTDOMAINS)
    {
        /* Split the redirect domains by comma */
        var domains = REDIRECTDOMAINS.toLowerCase().split(",");
        var urlHost = extractHostname(url);

        for (var i = 0; i < domains.length; i++) {

            if ((urlHost.toLowerCase()).endsWith(domains[i]))
            {
                return true;
            }
        }
        return false;
    }
    return true;
}


function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

});

</script>
