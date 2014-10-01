var base, dataRef, default_room = 'sketchy', dark_room = 'sketchy', room, connectedRef, ls,
	canvas, context, memcanvas, memcontext,
	user, user_id, user_name = false, user_ready,
	ispainting, drawEvent,
	isProjector = false,
	drawEvents = {},
	images = {},
	myEvents = [],
	offset_left, offset_top,
	width = 600, height = 600,
	size = 5,
	opacity = 100,
	sizes = [1, 2, 3, 5, 10, 15, 30, 50, 100, 200, 384, 400, 800],
	opacities = [5, 10, 20, 40, 60, 80, 100],
	colors = ['#000000','#ffffff','#52abca','#8b8d09','#d9531e','#e5b53b','#9cc5ca','#d2ccb8','#959484'],
	color = '',
	hexDigits = ["0","1","2","3","4","5","6","7","8","9","a","b","c","d","e","f"],	
	ctrlDown = false,
	delayDraw = true,
	drawing = true;

$(function(){
	// detect local storage support
	ls = supports_html5_storage();
	isiPad = navigator.userAgent.match(/iPad/i) != null;

	base = "https://sketchy.firebaseio.com/";
	dataRef = new Firebase(base);		

	canvas = $('#sketchy');
	context = canvas.get(0).getContext('2d');

	memcanvas = document.createElement('canvas');
	memcanvas.width  = width;
	memcanvas.height = height;
	memcontext = memcanvas.getContext('2d');

	canvas.on('click mousedown mouseup touchstart touchend touchcancel', eventHandler);
	//take care to continue watching mouse even outside of canvas
	$(document).on('mousemove touchmove', eventHandler); 

	$(document).on('mousedown mouseup mousemove', 'img', moveImage);
	$(document).on('dragstart', 'img', function(){ return false; });

	$(window).on('resize', windowResize);
	windowResize();

	$('#save').click(saveSketch);
	$('#new').click(newSketch);
	$('#clear').click(clearSketch);
	$('#move').click(toggleMove);

	$('#size .btn-down').click(sizeDown);
	$('#size .btn-up').click(sizeUp);
	$(document).on('keyup', function(e){
		//console.log(e.which);
		switch(e.which){
			case 221:
				sizeUp();
				break;
			case 219:
				sizeDown();
				break;
			case 187:
				opacityUp();
				break;
			case 189:
				opacityDown();
				break;
			case 90:
				console.log(e);
				if( e.ctrlKey ) undo();
				break;			
		}
	});
	setSize(size);

	$('#opacity .btn-down').click(opacityDown);
	$('#opacity .btn-up').click(opacityUp);
	setOpacity( opacity );

	$('#colorsPopover').popover({html: true, content: getColors}).click(function(e){ e.preventDefault(); });
	$(document).on('click touchend', '.color-chips .color-chip', pickColor);
	$(document).on('click touchend', '.more-colors', moreColors);
	setColor( colors[0] );
	
	// username field
	$('input[name=name]').on('keyup', setName);

	// setup room management
	$(window).on("hashchange", newSketchy);
	$('#new').click(newRoom);	
	$('#save').click(saveRoom);
	$('#projector').click(projectorMode);
	$('#undo').click(undo);

	// handle drag drop files
	$(document).on('drop', handleDrop)
		.on("dragover", cancel)
		.on("dragenter", cancel);

	$(document).on('keydown', '#input', submitChat);
	$(document).on('click touchstart', '#submit-chat', submitChat);
	$(document).on('click touchstart', '#clear-chat', clearChat);

	newSketchy(); // calls initSketchy with room	

	// Draw a loading messge that is removed when the drawing has loaded
	var loading = $('<div />')
	    .css({width:'100%', 'textAlign':'center', 'marginTop':280, 'position':'absolute', 'top': 0})
	    .html("Downloading Drawing")
	    .appendTo('#canvas-wrap');

	roomRef.once('value', function(){
		loading.hide();
		//drawEvents = s.val().draw;

		delayDraw = false;
		draw();
		// stash();
	});
});

function initSketchy(room){

	connectedRef = new Firebase(base +'.info/connected');

	roomRef = dataRef.child(room);
	drawRef = roomRef.child('draw');
	userRef = roomRef.child('user');
	imageRef = roomRef.child('image');
	chatRef = roomRef.child('chat');

	drawRef.on('child_added',   addDrawEvent);
	drawRef.on('child_changed', changeDrawEvent);
	drawRef.on('child_removed', removeDrawEvent);

	imageRef.on('child_added',   addImage);
	imageRef.on('child_changed', changeImage);
	imageRef.on('child_removed', removeImage);

	chatRef.on('child_added', addChat);
	chatRef.on('child_removed', removeChat);

	// Setup Users
	logon();
  	connectedRef.on('value', connectionMonitor);
	userRef.on('child_added',   addUser);
	userRef.on('child_changed', changeUser);
	userRef.on('child_removed', removeUser);
	//canvas.parent().on('mousemove touchmove', userMove);

	if(room == dark_room) {
    	$('html').addClass('dark');
    	$('.navbar').addClass('navbar-inverse');
    	$(document).on('userready', function(){
    		// console.log('ready');
    		setColor('#ffffff');
    		setOpacity(100);    	
    	});
  	} else {
  		$(document).on('userready', function(){
  			//setColor('#000000');
  			//setOpacity(100);
  		});
    	$('html').removeClass('dark');
    	$('.navbar').removeClass('navbar-inverse');
  	}
}

function closeSketchy(){
	// disconnect firebase links but leave canvas handlers
	user.off();
 	user.remove();
 	user_ready = false;
	drawRef.off();
  	userRef.off();
   	roomRef.off();
   	connectedRef.off();
   	$(document).off('userready');

   	canvas.parent().off();
   	// dont forget to wipe
   	_clear();
   	$('.marker, .badge, #canvas-wrap img').remove();
}

function newSketchy(){
	room = History.getHash() || default_room;
	if(typeof roomRef == 'object') closeSketchy();
	initSketchy(room);
	draw();
	return room;
}

function newRoom(e){
	e.preventDefault();	
	document.location.hash = _makeid();
}

function eventHandler(e){
	if(!drawing) return;

	switch (e.type) {
        case 'mousedown':
        case 'touchstart':
          startPainting();
          break;
        case 'mouseup':
        case 'mouseout':
        case 'mouseleave':
        case 'touchend':
        case 'touchcancel':
          if(ispainting) stopPainting();
          break;
    }


    // handle draw
    if(ispainting){
    	if(e.originalEvent && e.originalEvent.targetTouches) {
        	e.pageX = e.originalEvent.targetTouches[0].pageX;
        	e.pageY = e.originalEvent.targetTouches[0].pageY;
      	}
    	drawEvent.child('e').push({
    		x: e.pageX - offset_left,
    		y: e.pageY - offset_top
    	});
    }

    // mousemove
    user.child('pos').set({
    		x:e.pageX - offset_left, 
    		y:e.pageY - offset_top
    	}); 

    e.preventDefault();
}

function startPainting(){
	ispainting = true;
	drawEvent = drawRef.push();
	drawEvent.set({
		c: 'rgba('+ color +','+ (opacity / 100).toFixed(2) +')',
		s: size
	});	
	myEvents.push( {name: drawEvent.name(), type:"draw"} );
}

function stopPainting(){
	// drawEvent = null;
	// drawEventBuffer = null;
	ispainting = false;
}

function addDrawEvent(s){
	drawEvents[ s.name() ] = s.val();
	// console.log('add event');
	draw();
}

function changeDrawEvent(s){
	drawEvents[ s.name() ] = s.val();
	draw();
}

function draw(){
	if(delayDraw) return;

	width = window.innerWidth;
	//height = (window.innerHeight * 0.8) - 60;
	if(isProjector)
		height = window.innerHeight;
	else
	height = window.innerHeight - 60;

	context.canvas.width  = width;
  	context.canvas.height = height;
 //  	memcanvas.width  = width;
	// memcanvas.height = height;

	context.clearRect(0, 0, width, height);
    

    if(room == dark_room){
    	context.fillStyle = "#000000";    	
    }
    else {
    	context.fillStyle = "#ffffff";
    }
    //context.fillRect(0,0,width,height);		

    // replace the rendered canvas
    // context.drawImage(memcanvas, 0, 0);

    // draw the image as background

    $.each(images, function(i,s){
    	context.drawImage( s, 0, 0);
    });

    $.each(drawEvents, function(i,s){
    	if(s.e) { // only run if we have events
	    	var i = 1;
			context.beginPath();
			// s.child('e').forEach(function(cs){

			$.each(s.e, function(){
				if(i == 1) {				
					context.moveTo(this.x, this.y);
					// if there are no more events
					// console.log( s.e );
					if( Object.keys( s.e ).length == 1){
						// console.log('no more');
						context.lineTo(this.x+1, this.y);
        				context.lineTo(this.x+1, this.y+1);
        				context.lineTo(this.x,   this.y+1);
					}
				}
				else {
					var c = (previousEvent.x + this.x) / 2;
        			var d = (previousEvent.y + this.y) / 2;
        			context.quadraticCurveTo(previousEvent.x, previousEvent.y, c, d);
					// context.lineTo(this.x, this.y);
				}
				previousEvent = this;
				i++;			
			});

			context.lineJoin = "round";
			context.lineCap  = "round";
			context.strokeStyle = s.c;
			context.lineWidth   = s.s;
			context.stroke();
		}
	});
}

function stash(){
	// draws to a memory canvas and then deletes the events
	memcontext.clearRect(0, 0, width, height);
	memcontext.drawImage(context.canvas, 0, 0);
	drawEvents = {};
}

function removeDrawEvent(s){
	delete drawEvents[ s.name() ];
	draw();
}

function logon(){
  // Get the username from local storage if there is one
  // var user_name = false;

	if(ls && localStorage.getItem('name')) {
	  user_name = localStorage.getItem('name');
	  // if found, write it to the text field
	  $('input[name=name]').val( user_name );
	}
	else {
	  while(!user_name) {
	    user_name = prompt('What is your name?');
	    $('input[name=name]').val( user_name );
	    if(ls) localStorage.setItem('name', user_name);
	  }
	}

	if(!user_name || user_name == '')
	{
	  user_name = 'New User';
	  $('input[name=name]').val( user_name );
	}

  // Creading the user reference for the first time on load
  user = userRef.push();
  var newuser = {name: user_name, pos:{x: width/2, y:height/2}, s: size, c: color, o: (opacity/100), online:true};
  //console.log(newuser);
  user.set(newuser, userDidLogon);
  user_id = user.name();
  user_ready = false;

  $('#size').on('set', function(e, size){
  		//console.log('size set', size);
		
  });
  $('#colorsPopover').on('set', function(e, color){
  		//console.log('color set', color);
		user.child('c').set(color);
  });
  $('#opacity').on('set', function(e, opacity){
  		//console.log('opacity set', opacity);
		user.child('o').set(opacity);
  });
}

function userDidLogon(success){
	user_ready = true;
	$(document).trigger('userready');	
}

function connectionMonitor(snap) {
	if (snap.val() === true) {
	  // We're connected (or reconnected)!  Set up our presence state and tell
	  // the server to remove it when we leave.
	  user.onDisconnect().remove();
	}
}

function addUser(s){
	// prevent add user getting fired 
	if(typeof s !== 'object') return;
	var name = s.name();
	//console.log('newuser', s.val());
	var data = s.val();
	var badge = $('<div />').addClass('badge').attr('id', name).appendTo( canvas.parent() );
	var marker = $('<div />').addClass('marker').attr('id', name +'_marker').appendTo( canvas.parent() );

	// ignore myself on ipad
	if(data.pos) {

		badge
			
			.text( s.val().name )
			.css({
				left: data.pos.x + 10 + (data.s / 2),
    			top:  data.pos.y - 10
			});
				

		marker
			
			.css({
				width: data.s, 
				height: data.s, 
				left: data.pos.x - (data.s / 2), 
	    		top:  data.pos.y - (data.s / 2),
				backgroundColor: 'rgba('+ data.c +','+ data.o +')'
			});
			
	}

	if(data.p) {
		marker.hide();
		badge.hide();
	}

}

function changeUser(s){
	var badge = $('#'+ s.name());
	var marker = $('#'+ s.name() + "_marker");

	var data = s.val();	
	//console.log('changeuser', data);
	if(data.pos){
	    badge.text( s.val().name ).css({
	    	left: data.pos.x + 10 + (data.s / 2),
	    	top:  data.pos.y - 10
	    });
	    marker.css({
	    	left: data.pos.x - (data.s / 2), 
	    	top:  data.pos.y - (data.s / 2),
	    	width:  data.s,
	    	height: data.s,
	    	backgroundColor: 'rgba('+ data.c +','+ data.o +')'
	    });
	}
    if( data.p ) {
      badge.hide();
      marker.hide();
    }
}

function removeUser(s){	
	$('#'+ s.name()).remove();
	$('#'+ s.name() + "_marker").remove();
}


function saveSketch(){

}

function newSketch(){

}

function clearSketch(e){
	e.preventDefault();
	if(confirm('Are you sure you want to clear the canvas?')){
		drawRef.remove();
		imageRef.remove();
		_clear();
	}
}

function _clear(){
  drawEvents = {};
  images = {};
  context.clearRect(0, 0, width, height);
  memcontext.clearRect(0, 0, width, height);
}

function windowResize(){
  offset_left = $('#sketchy').eq(0).offset().left;
  offset_top  = $('#sketchy').eq(0).offset().top;
  draw();
}

function sizeDown(){
	var i = sizes.indexOf( size );
	if(i == 0 ) return false;

	if( --i <= 0 ) {
		i = 0;
		$('#size .btn-down').prop('disabled', true);
	}
	setSize( sizes[i] );
	$('#size .btn-up').prop('disabled', false);
}

function sizeUp(e){
	var i = sizes.indexOf( size );
	if(sizes.length -1 == i) return false;

	if( ++i == sizes.length -1 ) {
		i = sizes.length - 1;
		$(this).prop('disabled', true);
	}	
	setSize( sizes[i] );
	$('#size .btn-down').prop('disabled', false);
}

function setSize(s){
	size = s;
	var i = sizes.indexOf( size );
	if(i == (sizes.length - 1))
		$('#size .btn-up').prop('disabled', true);
	if(i == 0)
		$('#size .btn-down').prop('disabled', true);

	$('#size .input-updown').text( size +'px');

	// console.log(s);
	// if(user_name) user.child('s').set( size );
	// $('#size').trigger('set', size);
	if(user_ready)
		user.child('s').set(size);
	else {
		$(document).on('userready', function(){
			user.child('s').set(size);
		});
	}
}

function opacityDown(){
	var i = opacities.indexOf( opacity );
	if( i == 0) return false;

	if( --i <= 0 ) {
		i = 0;
		$('#opacity .btn-down').prop('disabled', true);
	}
	setOpacity(opacities[i]);	
	$('#opacity .btn-up').prop('disabled', false);
}

function opacityUp(){
	var i = opacities.indexOf( opacity );
	if(opacities.length -1 == i) return false;

	if( ++i == opacities.length -1 ) {
		i = opacities.length - 1;
		$(this).prop('disabled', true);
	}	
	setOpacity(opacities[i]);
	$('#opacity .btn-down').prop('disabled', false);
}

function setOpacity(o) {
	opacity = o;
	var i = opacities.indexOf( opacity );
	if(i == (opacities.length - 1))
		$('#opacity .btn-up').prop('disabled', true);
	if(i == 0)
		$('#opacity .btn-down').prop('disabled', true);

	$('#opacity .input-updown').text( opacity +'%');
	// $('#opacity').trigger('set', opacity / 100);
	if(user_ready)
		user.child('o').set( opacity/100 );
	else {
		$(document).on('userready', function(){
			user.child('o').set(opacity/100);
		});
	}
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? parseInt(result[1], 16) +","+ parseInt(result[2], 16) +","+ parseInt(result[3], 16) : null;
}

function getColors(){
	var c = $('<div><div class="color-chips"></div></div>');
	$.each(colors, function(){
		$('<div />').addClass('color-chip').css('background-color', this).appendTo(c.find('.color-chips'));
	});
	return c.html() + '<button class="btn btn-block more-colors"><i class="icon-plus"></i> More Colors</button>';
}

function pickColor(e){
	e.preventDefault();
	var c = $(this).css('backgroundColor');
	setColor( rgb2hex(c) );
	$('#colorsPopover').popover('toggle');
}

function setColor(hex){
	$('#colorsPopover .color-chip').css('backgroundColor', hex);
	color = hexToRgb( hex );
	// $('#colorsPopover').trigger('set', color);
	if(user_ready)
		user.child('c').set(color);
	else {
		$(document).on('userready', function(){
			user.child('c').set(color);
		});
	}
}

function moreColors(){
	$.ajax({
    url: 'http://www.colourlovers.com/api/palettes',
    dataType:'jsonp',
    data: {format: 'json', resultOffset: parseInt(Math.random() * 1000), numResults: 1},
    jsonp: 'jsonCallback',
    success: function(data){
    	//console.log(data);
    	$.each(data, function(){
	        //$('<img />').attr('src', this.imageUrl).appendTo('body');
	        $.each(this.colors, function(){
	        	var color = '#'+ this;
	        	colors.push( color );
	        	$('<div />').addClass('color-chip').css('background-color', color).appendTo('.color-chips');
	        });
    	});
    }
  });
}

function setName(e){
	user.child('name').set( $(this).val() );
	if(ls) localStorage.setItem('name', $(this).val() );
}

function supports_html5_storage() {
	try { return 'localStorage' in window && window['localStorage'] !== null; } 
	catch (e) { return false; }
}

function rgb2hex(rgb) {
	rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

function hex(x) {
  return isNaN(x) ? "00" : hexDigits[(x - x % 16) / 16] + hexDigits[x % 16];
 }

function _makeid(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < 5; i++ ) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function saveRoom(e){
	e.preventDefault();
	var mime;
	mime = "image/png";
	return window.open( canvas.get(0).toDataURL(mime));
}

// move addr bar out of view on ios
window.addEventListener("load",function() {
	// Set a timeout...
	setTimeout(function(){
		// Hide the address bar!
		window.scrollTo(0, 1);
	}, 0);
});

function projectorMode(){
	// hides everything unimportant
	isProjector = true;
	$('.navbar').hide();
	$('#'+ user_id).hide();
	$('#'+ user_id +'_marker').hide();
	$('body, .container-fluid').css({padding:0});
	//$(document).on('userready', function(){
		user.child('p').set(true);
	//});
	draw();
}

function handleDrop(e) {
  e.stopPropagation(); // Stops some browsers from redirecting.
  e.preventDefault();

  var files = e.originalEvent.dataTransfer.files;
  for (var i = 0, f; f = files[i]; i++) {
  	console.log(f);
    if (!f.type.match('image.*')) {
        continue;
    }
    if (f.type.match('image/gif')){
    	animated = true;
    }
    else {
    	animated = false;
    }

    var reader = new FileReader();
    reader.onload = (function(theFile) {
        return function(e) {
          // Render thumbnail.
          console.log(e);
          var newimage = imageRef.push({src: e.target.result, ani: animated});
          myEvents.push({name: newimage.name(), type: "image"});
        };
      })(f);

      // Read in the image file as a data URL.
      reader.readAsDataURL(f);
  }
}

function cancel(e) {
  if (e.preventDefault) e.preventDefault(); // required by FF + Safari
  e.originalEvent.dataTransfer.dropEffect = 'copy'; // tells the browser what drop effect is allowed here
  return false; // required by IE
}

function addImage(s){
	var name = s.name();
	var data = s.val();
	var ani = data.ani;
	var left = data.left || 0;
	var top = data.top || 0;

	var image = new Image();
	image.src = s.val().src;
	//if(ani){
		image.onload = function(){

			$(image).attr('id', name)
				.attr('draggable','false')
				.css({position:'absolute',left: left, top:top, zIndex:1});
			$('#canvas-wrap').append(image);
		}
	//}
	//else {
	//	image.onload = function(){
	//		images[ name ] = image;
			// console.log( image );
	//		draw();
	//	}
	//}
}

function removeImage(s){

	if(images[ s.name() ])
		delete images[ s.name() ];	
	$('#'+ s.name()).remove();

	draw();
	// console.log('remove', s.name(), images );
}

function undo(){
	// debugger;
	// take the last draw event
	var event = myEvents.pop();
	if(event) {
		if(event.type == "draw") drawRef.child( event.name ).remove();
		if(event.type == "image") imageRef.child( event.name ).remove();
	}

	console.log(event)

}

function toggleMove(e){
	if(!drawing){
		drawing = true;
		$('html').removeClass('move');
		$(this).html('Move');
	}
	else {
		$('html').addClass('move');
		drawing = false;
		$(this).html('Draw');
	}
}

function moveImage(e){
	if(drawing) return;
	if(e.type == 'mousedown'){
		xoff = e.pageX - $(e.target).position().left;
		yoff = e.pageY - $(e.target).position().top;

		var imgmove = function(f){
			var pos = {left: f.pageX -xoff, top:f.pageY -yoff};
			$(e.target).css(pos);
			imageRef.child( e.target.id ).update({left: f.pageX -xoff, top:f.pageY -yoff});
		};
		$(document).on('mousemove', imgmove);
		$(document).on('mouseup', function(){
			$(document).off('mousemove', imgmove);
		});
	}
	//console.log(e);
}

function changeImage(s){
	$('#'+ s.name()).css({left: s.val().left, top: s.val().top});
}

function submitChat(e){
	if(e.which !== 13) return;

	chat = $('#input').val();
	chat = "<strong>"+ user_name + ":</strong> "+ chat;
	chatRef.push(chat);
	$('#input').val('');
}

function addChat(s){
	$('#chat').append('<p>'+ s.val() +'</p>')
		.scrollTop( 99999 )
}
function removeChat(s){
	$('#chat').html('');
}
function clearChat(){
	chatRef.remove();
}