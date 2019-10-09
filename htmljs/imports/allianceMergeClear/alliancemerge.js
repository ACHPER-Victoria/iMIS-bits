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

var myWorker = new Worker('/common/Uploaded%20Files/Code/alliance-merge/AllianceMergeWorker.js');

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
  } else if( type === 'getFieldItems') {
    populatePullDownData(data);
  } else if( type === 'createAlliance') {
    createAllianceDone(data);
  } else if( type === 'getHeaders') {
    handleFilesDone(data);
  } else if( type === 'endProcessing') {
    endProcessing(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function populateFields() {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  workerMaker('getFieldItems', [document.getElementById("__RequestVerificationToken").value]);
}

// code, desc
function populatePullDownData(alliances) {
  var selectfield = jQuery("#TargetAlliancePullDown");
  jQuery('#TargetAlliancePullDown option:gt(0)').remove(); // remove all options, but not the first
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
  selectfield = jQuery("#IncAlliancePullDown");
  jQuery('#IncAlliancePullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of alliances) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false);
}

function disableUI(disable, start=true) {
  if (disable) {
    document.getElementById("createAlliance").setAttribute("disabled", "disabled");
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("createAlliance").removeAttribute("disabled");
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

function createAlliance() {
  disableUI(true);
  // worker
  // code newAllianceCodeInput
  var code = document.getElementById("newAllianceCodeInput").value
  // desc newAllianceDescInput
  var desc = document.getElementById("newAllianceDescInput").value
  if (!code) {
    mergelog("Missing code.");
    disableUI(false); return;
  }
  if (!desc) {
    mergelog("Missing description.");
    disableUI(false); return;
  }
  workerMaker('createAlliance', [document.getElementById("__RequestVerificationToken").value, code, desc]);
}
function createAllianceDone(data) {
  if (data) {
    mergelog("Created Alliance, refreshing list...");
    populatePullDown();
  } else {
    mergelog("Failed to create Alliance.");
    disableUI(false);
  }
}

function startProcessing() {
  // allow not everyone and no alliances from to clear a list.
  jQuery('textarea#mergelog').val("");
  var everyone = jQuery("#IncEveryone").is(":checked");
  var included = jQuery("#IncAlliancePullDown").val();
  var excluded = jQuery("#ExcAlliancePullDown").val();
  var output = jQuery("#TargetAlliancePullDown").val();
  // require output
  if (!output) {
    mergelog("Require Output alliance.");
    return;
  }
  // disableUI
  disableUI(true);
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    everyone, included, excluded, output]);
}

function endProcessing(data) {
  mergelog("Done.");
  disableUI(false, true);
}
