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

var myWorker = new Worker('/common/Uploaded%20Files/Code/subscribewall/SubscriptionModalWorker.js');
var MODAL = null;
var STATUS = null;

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'processEmail') {
    complete(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function storeModal(m) {
  MODAL = m;
}

function submitEmail(email, userid) {
  STATUS = false;
  workerMaker('processEmail', [document.getElementById("__RequestVerificationToken").value, email, userid]);
}

function complete(data) {
  jQuery('span#emailstatus').text("Done.");
  STATUS = true;
  // Email stored.
  // Let's store cookie so we don't keep prompting:
  Cookies.set('ACHsubscribemodal', 'yes', { expires: 182, path: '' })
  jQuery('span#emailstatus').text("Saved. Please wait...")
  location.reload();
  console.log("Reload now.");
}
function emailSaved() {
  return STATUS;
}

function modifyLinks() {
  // https://achper.vic.edu.au/public/resources/subscribe-login-resource.aspx
  jQuery(".sub-res-links a").attr('href', function(i, val) {
    if (val.startsWith("http://bit.ly") || val.startsWith("https://bit.ly") || val.startsWith("javascript:__")) {
      jQuery(this).attr('onClick', "modalinit();return false;");
      return "#";
    }
  });
}

function emailSubmit() {
  var userid = JSON.parse(document.getElementById("__ClientContext").value)["selectedPartyId"];
  if (userid == 217) {
    userid = "";
  }
  var emailaddr = jQuery('#emailaddrinput').val();
  if (!emailaddr || !emailaddr.includes("@")) {
    jQuery('span#emailstatus').html("<strong>Email address required.</strong>");
  } else {
    var status = emailSaved();
    if (status === true) {
      // Somehow user has tried to close the box but the page didn't reload before then... Maybe display message?
      jQuery('span#emailstatus').text("Please reload the page to gain access to the resource.")
    } else if (status === null) {
      // API call here
      submitEmail(emailaddr, userid);
      jQuery('span#emailstatus').text("Saving...");
    } else {
      // attempted to close another time, ignore
      return false;
    }
  }
}

function modalinit() {
  // instanciate new modal
  var modal = new tingle.modal({
      footer: true,
      stickyFooter: false,
      closeMethods: ['overlay', 'button', 'escape'],
      closeLabel: "Close",
      cssClass: ['custom-class-1', 'custom-class-2'],
      onOpen: function() {
          console.log('modal open');
      },
      onClose: function() {
          console.log('modal closed');
      },
      beforeClose: function() {
        return true; // alow close.
      }
  });
  // set content
  modal.setContent(`<h2> email address required </h2>
  To view this content you will need to submit your e-mail address. You consent to your e-mail address to be used for marketing purposes.
  <br>
  Email address: <input id="emailaddrinput">
  <br>
  <span id="emailstatus"></span>`);
  modal.addFooterBtn('Submit', 'tingle-btn tingle-btn--primary', emailSubmit);
  storeModal(modal);
  modal.open();
}

function processComsResponse(data) {
  var allow = false;
  if (data["CommunicationTypePreferences"]) {
    data["CommunicationTypePreferences"]["$values"].forEach(function(di) {
      if (di["CommunicationTypeId"] == "34df42a6-fc80-4032-92f1-262120c1ced0" && di["OptInFlag"] === true) {
          // modify links to subscription wall
          allow = true;
      }
    });
  }
  if (!allow) {
    // check cookie
    if (Cookies.get('ACHsubscribemodal') === 'yes') {
      return; // Cookie is set, so abort.
    } else { modifyLinks(); } // modify links
  }
}

function checkSubscription() {
  // Check for bypass flag:
  var check = (new URLSearchParams(window.location.search)).get('TOTW');
  if (check === "") { return; }

  var userid = JSON.parse(document.getElementById("__ClientContext").value)["selectedPartyId"];
  if (userid) {
    jQuery.ajax("/api/Party/"+userid,
    {
      type : "get",
      contentType: "application/json",
      headers: { "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value },
      success: processComsResponse
    });
  }
}
