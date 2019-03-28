function XLSExtension(viewer, options) {
  Autodesk.Viewing.Extension.call(this, viewer, options);
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
