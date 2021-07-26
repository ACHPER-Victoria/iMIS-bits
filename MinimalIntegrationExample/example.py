# Example file to talk to the iMIS API for the purpose of integrating for conference registration...
# See bottom of the file "Example starting execution point" L156 for the start of the example execution
import getpass
import requests
import copy
import re

##################
# Helper functions
##################
def spliteveryxfromright(s, x):
    n = []
    i = len(s)
    while (i>0+x+1):
        n.insert(0, s[i-x:i])
        i -= x
    if i != 0:
        n.insert(0, s[:i])
    return " ".join(n)
# function to provide variations on phone number formats for searching
# this probably won't work well on 13 18 numbers
def phone_formats(ph):
    # attempt to convert a provided phone string to international format:
    if ph.startswith("+"): ph = "+"+ re.sub("[^0-9.]","", ph)
    else: ph = re.sub("[^0-9.]","", ph)
    if ph.startswith("0"): ph = "+61"+ph[1:]
    elif not ph.startswith("+"): ph = "+61"+ph
    # okay now we have a somewhat reasonable baseline, yield possible alternative formatting
    yield ph
    yield ph.replace("+61", "0")
    yield spliteveryxfromright(ph, 3) # +61 400 000 000, +61 3999 999
    yield spliteveryxfromright(ph.replace("+61", "0"), 3) # 0400 000 000, 03 999 999
    t = ph.replace("+61", "0")
    yield "("+t[:2]+") "+spliteveryxfromright(t[2:], 4) # (03) 9999 9999, (04) 0000 0000
    t = ph.replace("+61", "0")
    yield "("+t[:4]+") "+spliteveryxfromright(t[4:], 3) # (0400) 000 000, (0399) 999 999

def findUser(s, h, email):
    phone = input("Phone: ")
    # search Person endpoint for email and phone
    # You will probably need to attempt multiple phone queries as we do not
    # normalize phone numbers on the database side
    query_params = [["Email", email], ["Phone", phone]]
    r = requests.get("%s/api/User" % s, headers=h, params=query_params)
    if (result.json()["Count"] == 1):
        return result.json()["Items"]["$values"][0]["UserId"]
    # If there's no results you'll probably want to try various permutations and
    # if there's multiple results... we'll just need to make a new contact card
    # and resolve the duplicate later
    for phone in phone_formats(phone):
        # try each of the phone transformations:
        query_params = [["Email", email], ["Phone", phone]]
        r = requests.get("%s/api/User" % s, headers=h, params=query_params)
        if (result.json()["Count"] == 1):
            return result.json()["Items"]["$values"][0]["UserId"]

REGISTRATION_BODY = { "$type": "Asi.Soa.Events.DataContracts.EventRegistrationRequest, Asi.Contracts",
    "EntityTypeName": "EventRegistration",
    "OperationName": "RegisterEvent",
    "RegistrationType": 3,
    "EventId": "",
    "RegistrationOptionFunctionId": "",
    "FunctionId": "",
    "RegistrantId": "",
    "RegisteredBy": "47538",
    "BillTo": "",
    "Waitlist": False
}

def buildRegData(eventid, regoptid, uid):
  body = copy.deepcopy(REGISTRATION_BODY)
  body["EventId"] = eventid
  # The format of this field is EVENTID/REGOPTIONID
  body["RegistrationOptionFunctionId"] = "%s/%s" % (eventid, regoptid)
  body["FunctionId"] = regoptid
  body["RegistrantId"] = uid
  body["BillTo"] = uid
  return body



########################
# Main Example Functions
########################
def authenticate(site):
    # Get login credentials
    username = input("Username: ")
    password = getpass.getpass()
    # get authorization token /token   (not: /api/token)
    formbody = {"Username" : username, "Password": password, "Grant_type": "password"}
    login_request = requests.post("%s/token" % site, headers={'content-type': "application/x-www-form-urlencoded"}, data=formbody)
    # reply is json, decode json then get the 'access_token' property and append it to the "Bearer " string.
    # You will then pass this token in all future request headers
    TOKEN = "Bearer %s" % login_request.json()[u'access_token']
    return TOKEN

def search_user(site, headers):
    # Because iMIS has severe flaws at the moment it's possible for someone's contact card
    # "primary email" to be different from their "username".
    # You should start by looking for the username first. If that fails you may want
    # to look for and compare primary email + mobile number and user that userID

    # Query the User endpoint for loginid (i.e. email)
    search_username = input("Search username (e.g. test99@domain.com): ")
    query_params = [["UserName", search_username]]
    result = requests.get("%s/api/User" % site, headers=headers, params=query_params)
    # You can usually query most parameters of a returned object from the query in the querystring.
    # In this case we are querying the User enpoint object's "Username" paramter.
    print(result.json())
    # In this case because we are querying the "Username" property (which should be unique)
    # We should only get one result, and it should be safe to assume the first result (if any)
    # Is the actual User
    # You will want to get the iMIS ID of that result and store, and use it for future queries.
    if (result.json()["Count"] > 0):
        imis_id = result.json()["Items"]["$values"][0]["UserId"]
        print ("Found: %s" % imis_id)
    # As a side note, the "findUser()" method will attempt to find a user based on supplied information.
    # You should attempt this if you are unable to find a user from querying the Username directly.
    else:
        imis_id = findUser(site, headers, search_username)
        if imis_id: print ("Found: %s" % imis_id)
        else:
            print("Didn't find user")
            exit()
    return imis_id

def check_registration(site, headers, imisID, eventID):
    # The following API call it formatted EVENTID-USERID, this api used to return 404 if the user had never registered.
    # Now just check for the presence of the "Status" property.
    result = requests.get("%s/api/EventRegistration/%s-%s" % (site, eventID, imisID), headers=headers)
    reg_status = None
    if result.json().get("Status", None) == None:
        print("User not registered.")
        reg_status = None
    elif result.json()["Status"] != 1:
        print("User registration is cancelled status.")
        reg_status = False
    elif result.json()["Status"] == 1:
        print("User has active registration.")
        reg_status = True
        for func in result.json()["Functions"]["$values"]:
            # Iterate over this property to see all the "functions" user has registered in.
            # NOTE: "Registration Option" also counts as a "function"
            # the following is a ternary operation. It just sets the string to "RegOpt: " if
            # "IsEventRegistrationOption" property is in the func object and truish
            regopt = "RegOpt: " if func["EventFunction"].get("IsEventRegistrationOption", False) else ""
            print("%s %s - %s" % (regopt, func["EventFunction"]["EventFunctionCode"], func["EventFunction"]["Name"]))
    return reg_status

def register_user(site, headers, imisID, eventID):
    # user has never registered before, register them for "REGOPTION2"
    data = buildRegData(eventID, "REGOPTION2", imisID)
    result = requests.post("%s/api/EventRegistration/_execute" % site, headers=headers, json=data)
    return result

##################################
# Example starting execution point
##################################
if __name__ == '__main__':
    ##################
    ### Initialization
    ##################
    # Get site
    SITE = input("Site (e.g. https://domain.com): ")

    # These are the headers you will use for all future requests
    HEADERS = {
        'content-type': "application/json",
        "Authorization" : authenticate(SITE)
    }

    ###################
    # Search for a user
    ###################
    IMIS_ID = search_user(SITE, HEADERS)
    # Now that you have the userID you should attach this to the record on your
    # system so you can easily perform actions on that user without attempting to "find" the user again.


    ################################
    # Check a registration of a user
    ################################
    # Okay, we have a userID. We'll look at register a user later on. For now, let's check the registration
    # for that user for a particular event.
    EVENT_ID = input("Event Code: ")
    REG_STATUS = check_registration(SITE, HEADERS, IMIS_ID, EVENT_ID)

    ##############################
    # Register a user for an event
    ##############################
    if REG_STATUS == None:
        # user has never registered before, register them for "REGOPTION2"
        result = register_user(SITE, HEADERS, IMIS_ID, EVENT_ID)
        if result.status_code == 200:
            print ("Registered.")
        else:
            print ("Error happened")
            exit()

    # rest TBC

    ################################
    # Add sessions to a registration
    ################################
    # TBC

    ######################
    ## Modify registration
    ######################
    # TBC

    ######################
    ## Cancel registration
    ######################
