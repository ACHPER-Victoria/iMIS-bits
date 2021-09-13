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
    query_params = [["Email", email], ["Phone", phone], ["limit", 2]]
    r = requests.get("%s/api/Person" % s, headers=h, params=query_params)
    if (r.json()["Count"] == 1):
        return r.json()["Items"]["$values"][0]["Id"]
    # If there's no results you'll probably want to try various permutations and
    # if there's multiple results... we'll just need to make a new contact card
    # and resolve the duplicate later
    for phone in phone_formats(phone):
        # try each of the phone transformations:
        query_params = [["Email", email], ["Phone", phone], ["limit", 2]]
        r = requests.get("%s/api/Person" % s, headers=h, params=query_params)
        if (r.json()["Count"] == 1):
            return r.json()["Items"]["$values"][0]["Id"]

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
    # As a side note, the "findUser()" method will attempt to find a user based on supplied information.
    # You should attempt this if you are unable to find a user from querying the Username directly.
    else:
        print("Didn't find by username, trying email+phone...")
        imis_id = findUser(site, headers, search_username)
    return imis_id

PERSON_BODY = {
    "$type": "Asi.Soa.Membership.DataContracts.PersonData, Asi.Contracts",
    "Addresses": {
        "$type": "Asi.Soa.Membership.DataContracts.FullAddressDataCollection, Asi.Contracts",
        "$values": [
            {
                "$type": "Asi.Soa.Membership.DataContracts.FullAddressData, Asi.Contracts",
                "Address": {
                    "$type": "Asi.Soa.Membership.DataContracts.AddressData, Asi.Contracts",
                    "AddressLines": {
                        "$type": "Asi.Soa.Membership.DataContracts.AddressLineDataCollection, Asi.Contracts",
                        "$values": [
                            "", # Street Address Line 1
                            "" # Street Address Line 2
                        ]
                    },
                    "CityName": "",
                    "CountryCode": "", # [E.g. "AU"] This is strictly the short country code
                    "CountryName": "", # [E.g. "Australia"] this is the long country name, however if short code above is provided, this is not needed.
                    "CountrySubEntityCode": "",  # [E.g. "VIC"] This is strictly the short state code
                    "CountrySubEntityName": "", # [E.g. "Victoria"] This is the long state name, however if shortcode above is provided, this is not needed.
                    "PostalCode": ""
                },
                "AddressPurpose": "Billing",
                "Email": "", # This should be the same e-mail address used below
                "Phone": ""   # This should be their mobile number, or if no mobile number, other number
            }
          ]
      },
    "Email": "",
    "PersonName": {
        "$type": "Asi.Soa.Membership.DataContracts.PersonNameData, Asi.Contracts",
        "FirstName": "",
        "LastName": "",
        "NamePrefix": ""
    },
    "Phones": {
        "$type": "Asi.Soa.Membership.DataContracts.PhoneDataCollection, Asi.Contracts",
        "$values": [ # OMIT THE OBJECTS HERE THAT YOU DONT NEED.
            {
                "$type": "Asi.Soa.Membership.DataContracts.PhoneData, Asi.Contracts",
                "IsPrimary": True,
                "Number": "", # [E.g. "0400000000" or "+61 400 000 000", etc.] Number goes here as string
                "PhoneType": "Mobile"
            },
            {
                "$type": "Asi.Soa.Membership.DataContracts.PhoneData, Asi.Contracts",
                "IsPrimary": False,
                "Number": "",
                "PhoneType": "Home"
            },
            {  # E.g. if "Work" number is not provided, don't include this block
                "$type": "Asi.Soa.Membership.DataContracts.PhoneData, Asi.Contracts",
                "IsPrimary": False,
                "Number": "",
                "PhoneType": "Work"
            }
        ]
    },
    "PrimaryOrganization": {
        "Name" : "",
        "Title" : "" # This field is someone's position title, as in their Role/position
    }
}

def create_user(site, headers):
    firstname = input("firstname: ")
    if not firstname.strip():
        # cancel and return if no firstname
        return
    pobj = copy.deepcopy(PERSON_BODY)
    pobj["PersonName"]["FirstName"] = firstname
    pobj["PersonName"]["LastName"] = input("lastname: ")
    pobj["PrimaryOrganization"]["Name"] = input("organisation: ")
    pobj["Addresses"]["$values"][0]["Address"]["AddressLines"]["$values"][0] = input("addrline1: ")
    pobj["Addresses"]["$values"][0]["Address"]["CountrySubEntityCode"] = input("state: ")
    pobj["Addresses"]["$values"][0]["Address"]["CityName"] = input("city: ")
    pobj["Addresses"]["$values"][0]["Address"]["PostalCode"] = input("postcode: ")
    email = input("email: ")
    pobj["Addresses"]["$values"][0]["Email"] = email
    pobj["Email"] = email
    mobile = input("mobile: ")
    pobj["Phones"]["$values"][0]["Number"] = mobile
    del pobj["Phones"]["$values"][2]
    del pobj["Phones"]["$values"][1] # Omit the numbers we aren't using

    result = requests.post("%s/api/Person" % site, headers=headers, json=pobj)
    if result.status_code != 201:
        print("Error:")
        print(result.text)
        return None
    else:
        # id of newly created person is in the Id property
        return result.json()["Id"]

def iterProp(item, prop, proptype="AdditionalAttributes"):
    for p in item[proptype]["$values"]:
        if p["Name"] == prop:
            return p["Value"]

def check_registration(site, headers, imisID, eventID):
    # The following API call is formatted EVENTID-USERID
    # Check for the presence of the "Status" property to see if a user has ever been registered for this event.
    # if status property exists, this user is registered or cancelled. If not exists, user has never registered.
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

def member_status(site, headers, iMISID):
    result = requests.get("%s/api/CsContact/%s" % (site, iMISID), headers=headers)
    if result.status_code != 200:
        return None, None
    else:
        # call helper function to iterate over "Properties" and find property of interest
        return [iterProp(result.json(), "MemberType", "Properties"),
            iterProp(result.json(), "PaidThrough", "Properties"),
            iterProp(result.json(), "RenewMonths", "Properties")["$value"]
        ]
    # return [membercode, paidthroughdate]

def register_user(site, headers, imisID, eventID):
    # user has never registered before, register them for "REGOPTION2"
    data = buildRegData(eventID, "REGOPTION2", imisID)
    result = requests.post("%s/api/EventRegistration/_execute" % site, headers=headers, json=data)
    return result


CANCEL_BODY = {
  "$type": "Asi.Soa.Core.DataContracts.GenericExecuteRequest, Asi.Contracts",
  "OperationName": "CancelEventRegistration",
  "EntityTypeName": "EventRegistration",
  "Parameters": {
    "$type": "System.Collections.ObjectModel.Collection`1[[System.Object, mscorlib]], mscorlib",
    "$values": [
        {
             "$type": "System.String",
             "$value": "EventRegistrationId" # replace this with the EVENTID-USERID
        },
        {
            "$type": "Asi.Soa.Commerce.DataContracts.OrderLineData, Asi.Contracts",
            "ChildOrderLines": {
                "$type": "Asi.Soa.Commerce.DataContracts.OrderLineDataCollection, Asi.Contracts",
                "$values": [
                    {
                        "$type": "Asi.Soa.Commerce.DataContracts.OrderLineData, Asi.Contracts"
                    }
                ]
            }
        }
    ]
  }
}
def cancel_registration(site, headers, regid):
    pobj = copy.deepcopy(CANCEL_BODY)
    pobj["Parameters"]["$values"][0]["$value"] = regid
    result = requests.post("%s/api/EventRegistration/_execute" % site, headers=headers, json=pobj)
    if result.status_code != 200:
        print("Error:")
        print(result.text)
        return None
    else:
        print("Cancelled registration for ID: %s" % regid)


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
    if IMIS_ID: print ("Found: %s" % IMIS_ID)
    else:
        print("Didn't find user")
        ###############
        # Create a user
        ###############
        # if you have exhausted all methods for finding a user, I suppose there's nothing left
        # but to create a new user:
        print("Creating user...")
        IMIS_ID = create_user(SITE, HEADERS)
    if not IMIS_ID:
        exit()

    ###############################
    # Check a information of a user
    ###############################
    # We have an ID, now we want to see information about that user. For privacy reasons
    # you need to be careful about what information you display to a user. Do not use
    # this informaiton to prefill fields. Only to use for pricing display purposes. e.g. member and until when
    MEMTYPE, PAID_THROUGH, MONTHS = member_status(SITE, HEADERS, IMIS_ID)
    print("Type: %s, Paid Through: %s, MONTHS: %s" % (MEMTYPE, PAID_THROUGH, MONTHS))
    if (MEMTYPE in ("VICF", "VICR", "VICS")):
        # check if monthly, allow membership pricing if current monthly member.
        if (MONTHS == 1.0):
            print("Allowed membership pricing.")
        else:
            # Otherwise, check PAID_THROUGH date includes conference date
            if (PAID_THROUGH > "2021-11-25T00:00:00"):
                print("Allowed membership pricing.")

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


    ######################
    ## Modify registration
    ######################
    # TBC

    ######################
    ## Cancel registration
    ######################
    # To cancel a registration you simply need to post the template body to this API endpoint
    # however you need to get the "EventRegistrationId" first, which is just EVENTID-USERID
    # So you should probably do "CheckRegistration" as above to make sure it's an active registration, then cancel it.
