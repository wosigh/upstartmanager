function UsMgrAssistant() {
	/* this is the creator function for your scene assistant object. It will be passed all the 
	   additional parameters (after the scene name) that were passed to pushScene. The reference
	   to the scene controller (this.controller) has not be established yet, so any initialization
	   that needs the scene controller should be done in the setup function below. */
}

UsMgrAssistant.prototype.identifier = 'palm://org.webosinternals.upstartmgr';

UsMgrAssistant.prototype.setup = function() {
	/* this function is for setup tasks that have to happen when the scene is first created */

	/* use Mojo.View.render to render view templates and add them to the scene, if needed. */

	/* setup widgets here */
	Mojo.Log.info("Set up attributes");

	/* Make the list uneditable by the user */
	this.listAttributes = {
		// Template for how to display list items
		itemTemplate: 'UsMgr/itemTemplate',
		swipeToDelete: false,
		reorderable: false,
		lookahead: 30,
		renderLimit: 40
		
	};
	Mojo.Log.info("Set up list model");

	/* Set a fake item, Give a title to the list */
	this.listModel = {
		listTitle: 'Running Services',
		items: [{name:"this.broke.horribly",state:"-1",status:0}]
	};

	/* Create the list widget */
	this.controller.setupWidget("UsMgr_list",this.listAttributes,this.listModel);

	/* Create the app menu */
	this.controller.setupWidget(Mojo.Menu.appMenu,this.attributes={omitDefaultItems:true},this.model={
		visible:true,
		items:[
			{label:"Sort by name",command:"sn"}
			,{label:"Sort by state",command:"sst"}
			,{label:"Sort by status",command:"sss"}
		]
	});
	/* add event handlers to listen to events from widgets */

	/* Set up the listener for tapping on list items */
	this.controller.listen("UsMgr_list", Mojo.Event.listTap, this.handleTap.bind(this));
	/* Default sort preference is by # of open service handles */
	this.sortPref = "name";
	//this.interval = setInterval(this.updateList.bind(this),5000);
	/* Holder of the last process list, keep it around so reordering list doesn't need to poll lunastats */
	this.lastList = {};
}

/* handler for app menu buttons */
UsMgrAssistant.prototype.handleCommand = function(event) {
	var f = this.appendList.bind(this);
	if (event.type === Mojo.Event.command)
	{
		switch(event.command)
		{
			case 'sn':
				this.sortPref = "name";
				f(this.lastList);
				break;
			case 'st':
				this.sortPref = "state";
				f(this.lastList);
				break;
			case 'sss':
				this.sortPref = "status";
				f(this.lastList);
				break;
			default: break;
		}
	}
}


/* Handle the tap on the list item */
UsMgrAssistant.prototype.handleTap = function(event) {
	var f = this.serviceControl.bind(this);
	f(event);
}

/* Confirm that you REALLY want to kill this item */
UsMgrAssistant.prototype.serviceControl = function(event) {
	var f = this.serviceControl.bind(this);
	var affirm = function(transport)
	{
		if (transport)
		{
			f(event);
		}
	}
	this.controller.showAlertDialog({
		onChoose:affirm,
		title:"Are you sure?",
		choices:[
			{label:"Kill it!",value:true,type:'affirmative'},
			{label:"No, don't do that!", value:false,type:'negative'}
		]
	});
}

/* Kills an app by pid# */
UsMgrAssistant.prototype.killProcess = function(event) {
	/* Make sure the click event came from a list item */
	Mojo.Log.info("Going to kill pid: " + event.item.pid);
	/* Call the Application Manager to kill the selection process */
	this.controller.serviceRequest('palm://com.palm.applicationManager', {
		method: 'close',
		/* The pid is used as the processId */
		parameters: {processId:event.item.pid},
		/* Redraw the list on success */
		onSuccess: this.updateList.bind(this),
		/* Do nothing on failure. This operation should NEVER FAIL */
		onFailure: function(){Mojo.Log.error("OH GOD A CLOSE FAILED");}
	});
}

UsMgrAssistant.prototype.activate = function(event) {
	/* put in event handlers here that should only be in effect when this scene is active. For
	   example, key handlers that are observing the document */
	
	/* Update the list with real info */
	var f = this.updateList.bind(this);
	f();
}


UsMgrAssistant.prototype.deactivate = function(event) {
	/* remove any event handlers you added in activate and do any other cleanup that should happen before
	   this scene is popped or another scene is pushed on top */
//	clearInterval(this.interval);
}

UsMgrAssistant.prototype.cleanup = function(event) {
	/* this function should do any cleanup needed before the scene is destroyed as 
	   a result of being popped off the scene stack */
}

/* Calls the service which knows about application statistics */
//UsMgrAssistant.prototype.updateList = function() {
//	/* Message com.palm.lunastats to give the VM stats */
//	this.controller.serviceRequest('luna://org.webosinternals.upstartmgr/list', {
//		method: 'list',
//		//For some reason, onSuccess never happens :(
//		onComplete: this.appendList.bind(this),
//	});
//}

UsMgrAssistant.prototype.updateList = function() {
	var request = new Mojo.Service.Request
	(
		UsMgrAssistant.prototype.identifier,
		{
			method: 'list',
			parameters: {subscribe:true},
			onComplete: this.appendList.bind(this),
		}
	);
	Mojo.Log.info("List Grabbed");
	return request;
}

UsMgrAssistant.startService = function(callback, id) {
	var request = new Mojo.Service.Request
	(
		UsMgrAssistant.identifier,
		{
			method: 'start',
			parameters:
			{
				'id': id
			},
			onSuccess: callback,
			onFailure: callback
		}
	);
	return request;
}

UsMgrAssistant.stopService = function(callback, id) {
	var request = new Mojo.Service.Request
	(
		UpstartService.identifier,
		{
			method: 'stop',
			parameters:
			{
				'id': id
			},
			onSuccess: callback,
			onFailure: callback
		}
	);
	return request;
}

/* Append the real processes to the Process List */
UsMgrAssistant.prototype.appendList = function(event) {
	/* save event */
	this.lastList = event;
	/* Used for debugging purposes */
	//for (var i in event.jobs[0]) {Mojo.Log.info(i);}
	/* sort by preference */
	var sorter = function (a,b) {
		var x = a;
		var y = b;
		if (this.sortPref == 'name')
		{
    		x = a.name.toLowerCase();
    		y = b.name.toLowerCase();
		}
		if (this.sortPref == 'state')
		{
    		x = a.state.toLowerCase();
    		y = b.state.toLowerCase();
		}
		if (this.sortPref == 'status')
		{
    		x = a.status.toLowerCase();
    		y = b.status.toLowerCase();
		}
		else
		{
			return 0;
		}
		return ((x < y) ? 1 : (x > y) ? -1 : 0);
	}
	/* Array holding all the processes */
	var services = new Array();
	//Mojo.Log.info("Add processes to list");
	services = event.jobs
	/* Sort list */
	services = services.sort(sorter.bind(this));
	/* Add the list of processes to the GUI list */
	this.controller.get("UsMgr_list").mojo.setLength(services.length);
	this.controller.get("UsMgr_list").mojo.noticeUpdatedItems(0,services);
};