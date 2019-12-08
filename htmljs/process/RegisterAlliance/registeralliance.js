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

var myWorker = new Worker('/common/Uploaded%20Files/Code/registeralliance/RegisterAllianceWorker.js');

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

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'mergelog') {
    mergelog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if (type === 'getEvents') {
    populateEvents(data);
  } else if (type === 'getFunctions') {
    populateFunctions(data);
  } else if (type === 'getHeaders') {
    handleFilesDone(data);
  } else if (type === 'getAlliances') {
    populateAlliances(data);
  } else if (type === 'endProcessing') {
    endProcessing(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

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

function getFunctions(event) {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  workerMaker('getFunctions', [document.getElementById("__RequestVerificationToken").value, event.target.value]);
}
function populateFunctions(functions) {
  var selectfield = jQuery("#RegOptionPullDown");
  jQuery('#RegOptionPullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of functions) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false, false);
}
function selectFunction(event) {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  if (event.target.value != "") { disableUI(false, true); }
  else { disableUI(false, false); }
}

function disableUI(disable, start=true) {
  if (disable) {
    document.getElementById("EventPullDown").setAttribute("disabled", "disabled");
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("EventPullDown").removeAttribute("disabled");
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

function startProcessing() {
  // allow not everyone and no alliances from to clear a list.
  jQuery('textarea#mergelog').val("");
  var included = jQuery("#IncAlliancePullDown").val();
  var excluded = jQuery("#ExcAlliancePullDown").val();
  var eventid = jQuery("#EventPullDown").val();
  var regoptid = jQuery("#RegOptionPullDown").val();

  // require eventid and regoptid
  if (!eventid || !regoptid) {
    mergelog("Require Event and Registration Option.");
    return;
  }
  // disableUI
  disableUI(true);
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    included, excluded, eventid, regoptid]);
}

function endProcessing(data) {
  mergelog("Done.");
  disableUI(false, true);
}

function getAlliances() {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  workerMaker('getAlliances', [document.getElementById("__RequestVerificationToken").value]);
}
function populateAlliances(alliances) {
  var selectfield = jQuery("#IncAlliancePullDown");
  jQuery('#IncAlliancePullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of alliances) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  selectfield = jQuery("#ExcAlliancePullDown");
  jQuery('#ExcAlliancePullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of alliances) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false);
}

window.addEventListener("load", _ => {
  document.getElementById('EventPullDown').addEventListener('change', getFunctions);
  document.getElementById('RegOptionPullDown').addEventListener('change', selectFunction);
  getEvents();
  getAlliances();
});
