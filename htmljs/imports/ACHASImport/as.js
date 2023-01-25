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

var myWorker = new Worker('/common/Uploaded%20Files/Code/as/asWorker.js');

function importlog(s) {
  var ta = jQuery('textarea#importlog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#importcount').text(i);
}
function setMaxProgress(i) {
  jQuery('span#importtotal').text(i);
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
  if (type === 'importlog') {
    importlog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if( type === 'getFieldItems') {
    populatePullDownData(data);
  } else if( type === 'getHeaders') {
    handleFilesDone(data);
  } else if( type === 'endProcessing') {
    endProcessing(data);
  } else if( type === 'getFundingCats') {
    gotFundingCats(data);
  } else if( type === 'ping') {
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function disableUI(disable, start=false) {
  if (disable) {
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

CSVFILE = null;
function handleFiles(flist) {
  // clear csvfields
  disableUI(true);
  jQuery('#csvfields li').remove();
  // getHeaders
  CSVFILE = flist[0]
  workerMaker('getHeaders', [document.getElementById("__RequestVerificationToken").value, CSVFILE]);
}
FIELDS = [["Contact iMIS ID", "imisid"], ["Staff iMIS ID", "ACH_Staff"], ["Applicant Email", "OriginalAppEmail"],
  ["Applicant First Name", "OriginalAppFName"],
  ["School no.", "SchoolNum"],["School Type", "Type"], ["SFOE Band", "Rating"],
  ["SFOE Index", "Index"], ["Region name", "Region"], ["LGA Name", "LGA"],
  ["Area Name", "Area"], ["SSV Region Abbreviation", "ssvregabb"], ["Students Total", "TotalStudents"]];
function handleFilesDone(headers) {
  var listelem = jQuery("#csvfields");
  FIELDS.forEach(function(i) {
    // create select list item
    var s = jQuery("<select id='{0}'></select>".format(i[1]));
    s.append(jQuery("<option></option>").attr("value", "").text("(NONE)"));
    headers.forEach(function (h) {
      s.append(jQuery("<option></option>").attr("value", h).text(h));
    });
    listelem.append(jQuery("<li></li>").append(jQuery("<span>{0}</span>".format(i[0])).add(s)));
  });
  if (headers != null) {
    document.getElementById("startbutton").removeAttribute("disabled");
  } else {
    document.getElementById("startbutton").setAttribute("disabled", "disabled");
  }
  disableUI(false);
}

function startProcessing() {
  if (CSVFILE === null) { importlog("No file selected"); return; }
  // get headerfields
  disableUI(true, true);
  var fields = {};
  for (const v of FIELDS) {
    fields[v[1]] = jQuery("#"+v[1]).val()
  }
  var removeold = jQuery("#removeold").is(":checked");
  var dry = jQuery("#dryrun").is(":checked");
  var fundingcat = jQuery("#fundingcat").val();
  jQuery('#downlist li').remove();
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    CSVFILE, fields, fundingcat, removeold, dry]);
}
DOWNLINKS = ["NotFound", "Found"]; //nf, found
function endProcessing(data) {
  var downlist = document.getElementById("downlist");
  for(var i=0;i<DOWNLINKS.length;i++) {
    var node = document.createElement("li");
    if (data[i] != false) {
      data[i] = "\ufeff"+data[i];
      var csvData = new Blob([data[i]], {type: 'text/csv;charset=utf-8;'});
      var exportFilename = "{0}-{1}.csv".format(DOWNLINKS[i], (new Date()).toISOString().slice(0,16))
      var link = document.createElement('a');
      link.href = window.URL.createObjectURL(csvData);
      link.setAttribute('download', exportFilename);
      link.innerHTML = exportFilename;
    } else {
      var link = document.createElement('span');
      link.innerHTML = DOWNLINKS[i]+" - 0";
    }
    node.appendChild(link);
    downlist.appendChild(node);
    disableUI(false, true);
  }
}

function doPing() {
  workerMaker('ping', [document.getElementById("__RequestVerificationToken").value]);
}
function getCats() {
  workerMaker('getFundingCats', [document.getElementById("__RequestVerificationToken").value]);
}
function gotFundingCats(values) {
  var s = jQuery("#fundingcat");
  for (let [code,desc] of values) {
    s.append(new Option(desc, code));
  }
}

window.addEventListener("DOMContentLoaded", () => { setTimeout(doPing, 50000); getCats(); });
