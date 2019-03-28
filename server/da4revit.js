/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

// token handling in session
var token = require('./token');


// web framework
var express = require('express');
var router = express.Router();

// forge
// var forgeSDK = require('forge-apis');




const {
    ItemsApi,
    VersionsApi,
} = require('forge-apis');


const { 
    upgradeColumnInfo, 
    getLatestVersionInfo, 
    getNewCreatedStorageInfo, 
    createBodyOfPostVersion,
    workitemList 
} = require('./common/da4revitImp')

// const SOCKET_TOPIC_WORKITEM = 'Workitem-Notification';





///////////////////////////////////////////////////////////////////////
/// upgrade revit file to specified version using Design Automation 
/// for Revit API
///////////////////////////////////////////////////////////////////////
router.post('/da4revit/v1/columns', async (req, res, next ) => {
    var tokenSession = new token(req.session);
    if (!tokenSession.isAuthorized()) {
        res.status(401).end('Please login first');
        return;
    }

  
    const fileItemId   = req.body.fileItemId;
    const fileItemName = req.body.fileItemName;

    if (fileItemId === '' || fileItemName === '') {
        res.status(500).end();
        return;
    }

    if (fileItemId === '#') {
        res.status(500).end('not supported item');
    } 

    const params = fileItemId.split('/');
    if( params.length < 3){
        res.status(500).end('selected item id has problem');
    }

    const resourceName = params[params.length - 2];
    if (resourceName !== 'items') {
        res.status(500).end('not supported item');
        return;
    }

    const resourceId = params[params.length - 1];
    const projectId = params[params.length - 3];

    try {
        const items = new ItemsApi();
        const folder = await items.getItemParentFolder(projectId, resourceId, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials());
        if(folder === null || folder.statusCode !== 200){
            console.log('failed to get the parent folder.');
            res.status(500).end('ailed to get the parent folder');
            return;
        }

        const fileParams = fileItemName.split('.');
        const fileExtension = fileParams[fileParams.length-1].toLowerCase();
        if( fileExtension !== 'rvt'){
            console.log('info: the file format is not supported');
            res.status(500).end('the file format is not supported');
            return;
        }

        const storageInfo = await getNewCreatedStorageInfo(projectId, folder.body.data.id, fileItemName, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials());
        if (storageInfo === null ) {
            console.log('failed to create the storage');
            res.status(500).end('failed to create the storage');
            return;
        }
        const outputUrl = storageInfo.StorageUrl;


        // get the storage of the input item version
        const versionInfo = await getLatestVersionInfo(projectId, resourceId, tokenSession.getInternalOAuth(), tokenSession.getInternalCredentials());
        if (versionInfo === null ) {
            console.log('failed to get lastest version of the file');
            res.status(500).end('failed to get lastest version of the file');
            return;
        }
        const inputUrl = versionInfo.versionUrl;

        const createVersionBody = createBodyOfPostVersion(resourceId,fileItemName, storageInfo.StorageId, versionInfo.versionType);
        if (createVersionBody === null ) {
            console.log('failed to create body of Post Version');
            res.status(500).end('failed to create body of Post Version');
            return;
        }

        ////////////////////////////////////////////////////////////////////////////////
        // use 2 legged token for design automation
        const oauth_client = tokenSession.get2LeggedClient();;
        const oauth_token = await oauth_client.authenticate();
        let upgradeRes = await upgradeColumnInfo(inputUrl, outputUrl, projectId, createVersionBody, fileExtension, tokenSession.getInternalCredentials(), oauth_token );
        if(upgradeRes === null || upgradeRes.statusCode !== 200 ){
            console.log('failed to upgrade the revit file');
            res.status(500).end('failed to upgrade the revit file');
            return;
        }
        console.log('Submitted the workitem: '+ upgradeRes.body.id);
        const upgradeInfo = {
            "fileName": fileItemName,
            "workItemId": upgradeRes.body.id,
            "workItemStatus": upgradeRes.body.status
        };
        res.status(200).end(JSON.stringify(upgradeInfo));

    } catch (err) {
        console.log('get exception while upgrading the file')
        res.status(500).end(err);
    }
});



///////////////////////////////////////////////////////////////////////
///
///////////////////////////////////////////////////////////////////////
router.post('/callback/designautomation', async (req, res, next) => {
    // Best practice is to tell immediately that you got the call
    // so return the HTTP call and proceed with the business logic
    res.status(202).end();

    let workitemStatus = {
        'WorkitemId': req.body.id,
        'Status': "Success"
    };
    if (req.body.status === 'success') {
        const workitem = workitemList.find( (item) => {
            return item.workitemId === req.body.id;
        } )

        if( workitem === undefined ){
            console.log('The workitem: ' + req.body.id+ ' to callback is not in the item list')
            return;
        }
        let index = workitemList.indexOf(workitem);
        // workitemStatus.Status = 'Success';
        // global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        // console.log("Post handle the workitem:  " + workitem.workitemId);

        const type = workitem.createVersionData.data.type;
        try {
            let version = null;
            if(type === "versions"){
                const versions = new VersionsApi();
                version = await versions.postVersion(workitem.projectId, workitem.createVersionData, req.oauth_client, workitem.access_token_3Legged);
            }else{
                const items = new ItemsApi();
                version = await items.postItem(workitem.projectId, workitem.createVersionData, req.oauth_client, workitem.access_token_3Legged);
            }
            if( version === null || version.statusCode !== 201 ){ 
                console.log('Falied to create a new version of the file');
                workitemStatus.Status = 'Failed'
            }else{
                console.log('Successfully created a new version of the file');
                workitemStatus.Status = 'Completed';
            }
            // global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);

        } catch (err) {
            console.log(err);
            // workitemStatus.Status = 'Failed';
            // global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        }
        finally{
            // Remove the workitem after it's done
            workitemList.splice(index, 1);
        }

    }else{
        // Report if not successful.
        workitemStatus.Status = 'Failed';
        // global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        console.log(req.body);
    }
    return;
})



module.exports = router;
