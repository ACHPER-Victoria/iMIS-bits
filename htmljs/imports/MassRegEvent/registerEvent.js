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

var myWorker = new Worker('/common/Uploaded%20Files/Code/MassRegEvent/registerEventWorker.js');

function mergelog(s) {
  var ta = jQuery('textarea#mergelog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#mergecount').text(i);
}
function setMaxProgress(i) {
  jQuery('span#mergetotal').text(i);
}

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

myWorker.onmessage = function(ev) {
  //console.log('Message received from worker');
  const response = ev.data;
  const data = response.data;
  const type = response.type;
  if (type === 'mergelog') {
    mergelog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if( type === 'getEvents') {
    populateEvents(data);
  } else if( type === 'getHeaders') {
    handleFilesDone(data);
  } else if ( type == 'getRegOption') {
    gotRegOption(data);
  } else if ( type == 'getMemOption') {
    gotMemOption(data);
  } else if( type === 'endProcessing') {
    endProcessing(data);
  } else if( type === 'getInvoiceData') {
    gotInvoiceData(data);
  } else if( type === 'doneInvoice') {
    doneInvoice(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}
CSVFILE = null;

function getEvents() {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  workerMaker('getEvents', [document.getElementById("__RequestVerificationToken").value]);
}
function populateEvents(events) {
  var selectfield = jQuery("#EventPullDown");
  jQuery('#EventPullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of events) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false, false);
}

function changeRegField(event) {
  var actualevent = jQuery("#EventPullDown").val();
  if (actualevent) {
    disableUI(true);
    workerMaker('getRegOption', [document.getElementById("__RequestVerificationToken").value, CSVFILE, event.target.value, actualevent]);
  }
}
REGOPTIONS = [];
function gotRegOption(data) {
  //data is actually a Set and list : regoptions, eventregoptions
  REGOPTIONS = [];
  var regoptions = data[0];
  var eventregoptions = data[1]
  var listelem = jQuery("#regopts");
  var index = 0;
  for (var regopt of regoptions) {
    REGOPTIONS.push([index,regopt]);
    var s = jQuery("<select id='RO-{0}'></select>".format(index));
    s.append(jQuery("<option></option>").attr("value", "").text("(NONE)"));
    for (var [code, title] of eventregoptions) {
      s.append(jQuery("<option></option>").attr("value", code).text(title));
    }
    listelem.append(jQuery("<li></li>").append(jQuery("<span>{0}</span>".format(regopt)).add(s)));
    index++;
  }
  disableUI(false, true);
}

function gotInvoiceData(data) {
  // data is [imisid, item["InvoiceId"], item["SoldToParty"]["Name"], item["Description"]]
  var selectfield = jQuery("#invoices");
  selectfield.append(jQuery("<option selected></option>")
    .attr("value", data[1]).text("{0}, {1}, {2}, {3}".format(data[0], data[1], data[2], data[3]))
  );
}

function doneInvoice(data) {
  jQuery("#invoices option[value='{0}']".format(data)).remove();
}

function changeMemField(event) {
  disableUI(true);
  workerMaker('getMemOption', [document.getElementById("__RequestVerificationToken").value, CSVFILE, event.target.value]);
}
function gotMemOption(data) {
  //data is actually a Set and list : regoptions, eventregoptions
  var selectfield = jQuery("#memopts");
  jQuery('#memopts option:gt(0)').remove(); // remove all options, but not the first
  for (let i of data) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i).text(i));
  }
  disableUI(false, true);
}


function handleFiles(flist) {
  // clear csvfields
  disableUI(true);
  jQuery('#csvfields li').remove();
  // getHeaders
  CSVFILE = flist[0]
  workerMaker('getHeaders', [document.getElementById("__RequestVerificationToken").value, CSVFILE]);
}
FIELDS = [["iMIS ID", "uid"], ["Registration Option", "regoption"], ["Membership column", "membership"]
//  ["Email address", "email"], ["Phone", "phone"]
];
function handleFilesDone(data) {
  var headers = data;
  var listelem = jQuery("#csvfields");
  for (var i of FIELDS) {
    // create select list item
    var s = jQuery("<select id='{0}'></select>".format(i[1]));
    s.append(jQuery("<option></option>").attr("value", "").text("(NONE)"));
    for (var h of headers) {
      s.append(jQuery("<option></option>").attr("value", h).text(h));
    }
    if (i[1] == "regoption") {
      s.change(changeRegField);
    }
    if (i[1] == "membership") {
      s.change(changeMemField);
    }
    listelem.append(jQuery("<li></li>").append(jQuery("<span>{0}</span>".format(i[0])).add(s)));
  }
  if (headers != null) {
    document.getElementById("startbutton").removeAttribute("disabled");
  } else {
    document.getElementById("startbutton").setAttribute("disabled", "disabled");
  }
  disableUI(false);
}

function disableUI(disable, start=true) {
  if (disable) {
    document.getElementById("EventPullDown").setAttribute("disabled", "disabled");
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    document.getElementById("clist").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("EventPullDown").removeAttribute("disabled");
    document.getElementById("resetbutton").removeAttribute("disabled");
    document.getElementById("clist").removeAttribute("disabled");
    if (start) { 
      document.getElementById("startbutton").removeAttribute("disabled"); 
      document.getElementById("reversebutton").removeAttribute("disabled"); 
    }
  }
}

function startProcessing() {
  // allow not everyone and no alliances from to clear a list.
  jQuery('textarea#mergelog').val("");
  var fields = {
    "uid" : jQuery("#uid").val(),
    "regoption" : jQuery("#regoption").val(),
    "membership" : jQuery("#membership").val(),
  }
  // require output
  if (!fields["uid"] || !fields["regoption"]) {
    mergelog("Require ID and Registration Option column.");
    return;
  }
  // build regoptions map...
  regopts = {};
  for (var [index,code] of REGOPTIONS) {
    regopts[code] = jQuery("#RO-{0}".format(index)).val();
  }
  var actualevent = jQuery("#EventPullDown").val();
  if (!actualevent) {
    mergelog("Need event.");
    return;
  }
  // get membership values if thing...
  var memopts = [];
  if (fields["membership"]) {
    memopts = jQuery("#memopts").val();
  }
  var memdate = document.getElementById("memdate").value;
  // disableUI
  disableUI(true);
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    CSVFILE, fields, actualevent, regopts, memopts, memdate]);
}

function endProcessing(data) {
  mergelog("Done.");
  disableUI(false, true);
}

function startReverse() {
  // allow not everyone and no alliances from to clear a list.
  jQuery('textarea#mergelog').val("Reversing...");
  var invoices = jQuery("#invoices").val();
  // require invoices
  if ((invoices.length == 1 && invoices[0] == "") || invoices.length < 1) {
    mergelog("Require invoices to be selected...");
    return;
  }
  disableUI(true);
  workerMaker('startReversing', [document.getElementById("__RequestVerificationToken").value, invoices]);
}

window.addEventListener("load", _ => {
  getEvents();
  const d = new Date();
  const ld = new Date(Date.UTC(d.getFullYear(), d.getMonth()+12, 0));
  ld.toISOString().split('T')[0]
  document.getElementById("memdate").value = ld.toISOString().split('T')[0];
});
