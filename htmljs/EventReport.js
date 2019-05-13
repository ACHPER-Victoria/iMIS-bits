// First Name, Last Name, Org, Member, Sector, Region, Special Diet, How did you hear about, Purchase Order Numb
// Amount, Session A, Session B, Session C, Invoice Number, email, Reg status, Registration Option
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var eventid = (new URLSearchParams(window.location.search)).get("ID")

// Get Event Details
jQuery.ajax("/api/Event/{0}".format(eventid),
{
  type : "get",
  contentType: "application/json",
  async: false,
  headers: { "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value },
  success: function(data) {
    // collate Conflict Code data
    var conflictcodes = [];
    var conflicttable = {};
    var regoptions = {};
    data["Functions"]["$values"].foreach(function(item) {
      var cc = item["ConflictCodes"]; // check if contains digit, ignore if so
      if (!(/\d/.test(cc))) {
        if (!conflictcodes.includes(cc)) {
          conflictodes.append(cc);
        }
        if (item["EventFunctionCode"] in conflicttable) {}
        else {conflicttable[item["EventFunctionCode"]] = cc; }
      }
    });
    data["RegistrationOptions"]["$values"].foreach(function(item) {
      regoptions[item["EventFunctionId"]] = item["Name"]
    });
  }
});

// iterate over registration options

// list all regfuction entries for registration option
