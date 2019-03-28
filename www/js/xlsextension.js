function XLSExtension(viewer, options) {
  Autodesk.Viewing.Extension.call(this, viewer, options);
  this.data = {"Columns":[]};
}

XLSExtension.prototype = Object.create(Autodesk.Viewing.Extension.prototype);
XLSExtension.prototype.constructor = XLSExtension;


  function statusCallback(completed, message) {
    $.notify(message, { className: "info", position:"bottom right" });
    $('#downloadExcel').prop("disabled", !completed);
  }


XLSExtension.prototype.load = function () {
  var _viewer = this.viewer;


  // get Forge token (use your data:read endpoint here)
  // this sample is using client-side JavaScript only, so no
  // back-end that authenticate with Forge nor files, therefore
  // is using files from another sample. On your implementation,
  // you should replace this with your own Token endpoint
  function getForgeToken(callback) {
    jQuery.ajax({
      url: '/forge/oauth/token',
      success: function (oauth) {
        if (callback)
          callback(oauth.access_token, oauth.expires_in);
      }
    });
  }


  createUI = function () {
    // Button 1
    var button1 = new Autodesk.Viewing.UI.Button('toolbarXLS');
    button1.onClick = function (e) {
        ForgeXLS.downloadXLSX(documentId, fileName + ".xlsx", token, statusCallback, fileType );/*Optional*/
    };
    button1.addClass('toolbarXLSButton');
    button1.setToolTip('Export to .XLSX');


    // Button 2
    var button2 = new Autodesk.Viewing.UI.Button('toolbarSubmit');
    button2.onClick = function (e) {
      
      let sourceNode = $('#dataManagementHubs').jstree(true).get_selected(true)[0];
      if(sourceNode === null){
        alert('Can not get the selected source folder, please make sure you select a folder as source');
        return;
      }
      upgradeColumnInfo(sourceNode.id, fileName);
    };
    button2.addClass('toolbarSubmitButton');
    button2.setToolTip('Submit column information');
    // SubToolbar
    this.subToolbar = new Autodesk.Viewing.UI.ControlGroup('myAppGroup1');
    this.subToolbar.addControl(button2);
    this.subToolbar.addControl(button1);


    _viewer.toolbar.addControl(this.subToolbar);




    // Denis code

    this.ui = document.createElement("div");
    this.ui.id = "control_area";
    this.ui.classList.add("docking-panel-container-solid-color-a");
    this.ui.innerHTML = `
            <div id="controlsArea">
                <div><span>BGEReinforcement: </span><input type="text" value=0 id="BGEReinforcement"></div>
                <div><span>BGELoadTensionMax: </span><input type="text" value=0 id="BGELoadTensionMax"></div>
                <div><span>BGELoadLiveMax: </span><input type="text" value=0 id="BGELoadLiveMax"></div>
                <div><span>BGELoadDeadMax: </span><input type="text" value=0 id="BGELoadDeadMax"></div>
                <button id="commit">Commit</button>
                <button id="send">send</button>
            </div>
        `;

    let panel = this.panel;
    // check https://forge.autodesk.com/blog/extension-skeleton-toolbar-docking-panel
    let toolbarButtonPropertyAdder = new Autodesk.Viewing.UI.Button('PropertyAdder');

    if (panel == null) {
      panel = new DataAddingPanel(_viewer, _viewer.container,
          'controlPanel', 'Control Panel', {"innerDiv":this.ui});
    }



    // bindings
    let controller1 = document.getElementById("BGEReinforcement");
    let controller2 = document.getElementById("BGELoadTensionMax");
    let controller3 = document.getElementById("BGELoadLiveMax");
    let controller4 = document.getElementById("BGELoadDeadMax");


    let CommitButton = document.getElementById("commit");

    CommitButton.onclick = () => {
      this.data["Columns"].push({
        "ColumnId": this.viewer.getSelection()[0],
        'BGEReinforcement': controller1.value,
        'BGELoadTensionMax': controller2.value,
        'BGELoadLiveMax': controller3.value,
        'BGELoadDeadMax': controller4.value
      });


    };


    let SendButton = document.getElementById("send");

    SendButton.onclick = () => {
      fetch("/da4revit/v1/columns",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(this.data),
          });
    }


  };

  createUI();

  return true;
};


XLSExtension.prototype.unload = function () {
  alert('XLSExtension is now unloaded!');
  return true;
};


function upgradeColumnInfo(fileItemId, fileItemName) {
  let def = $.Deferred();

  jQuery.post({
    url: '/da4revit/v1/columns',
    contentType: 'application/json',
    dataType:'json',
    data: JSON.stringify({
      'fileItemId': fileItemId,
      'fileItemName': fileItemName
    }),
    success: function (res) {
      def.resolve(res);
    },
    error: function (err) {
      def.reject(err);
    }
  });
  return def.promise();
}

Autodesk.Viewing.theExtensionManager.registerExtension('Autodesk.Sample.XLSExtension', XLSExtension);



// *******************************************
// Data Adding Panel
// *******************************************
function DataAddingPanel(viewer, container, id, title, options) {
  this.viewer = viewer;

  Autodesk.Viewing.UI.DockingPanel.call(this, container, id, title, options);

  // the style of the docking panel
  // use this built-in style to support Themes on Viewer 4+

  this.container.appendChild(options.innerDiv);
  this.container.style = `
    bottom: 10px;
    right: 10px;
    width: 300px;
    height: 200px;
    resize: none;
    `

}
DataAddingPanel.prototype = Object.create(Autodesk.Viewing.UI.DockingPanel.prototype);
DataAddingPanel.prototype.constructor = DataAddingPanel;