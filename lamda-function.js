'use strict';

/* ----------------------- IoT Configuration -------------------------------- */

var config = {};

config.IOT_BROKER_ENDPOINT = "XXXXXXXXXXXXXX.iot.us-east-1.amazonaws.com".toLowerCase();

config.IOT_BROKER_REGION = "us-east-1";

config.IOT_THING_NAME = "EdisonDemo";

// Load AWS SDK libraries
var AWS = require('aws-sdk');

AWS.config.region = config.IOT_BROKER_REGION;

// Initialize client for IoT
var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT});

/* -------------------- end: IoT Configuration ------------------------------ */


/* ------------ Helpers that build all of the responses --------------------- */

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {

    return {
        outputSpeech: {
            type: 'PlainText',
            text: output,
        },
        card: {
            type: 'Simple',
            title: `SessionSpeechlet - ${title}`,
            content: `SessionSpeechlet - ${output}`,
        },
        reprompt: {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            },
        },
        shouldEndSession,
    };

}

function buildResponse(sessionAttributes, speechletResponse) {

    return {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };

}

/* ---------- end: Helpers that build all of the responses ------------------ */


/* ----------- Functions that control the skill's behavior ------------------ */

function getWelcomeResponse(callback) {

    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'Welcome to the Edison Internet of Things demo. ' +
        'Please tell me if you want the light on or off by saying, turn the light on';
    // If the user either does not reply to the welcome message or says something that is not understood, they will be prompted again with this text.
    const repromptText = 'Please tell me if you want the light on or off by saying, ' +
        'turn the light on';
    const shouldEndSession = false;

    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));

}

function handleSessionEndRequest(callback) {

    const cardTitle = 'Session Ended';
    const speechOutput = 'Thank you for using the Edison Internet of Things demo. Have a nice day!';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));

}

function createFavoriteRelayStatusAttributes(desiredRelayStatus) {

    return {desiredRelayStatus,};

}

/**
 * Sets the relay state in the session and prepares the speech to reply to the user.
 */
function setRelayStatusInSession(intent, session, callback) {

    const cardTitle = intent.name;
    const desiredRelayStatusSlot = intent.slots.Status;
    var shadowRelayStatus = false;
    let repromptText = '';
    let sessionAttributes = {};
    const shouldEndSession = false;
    let speechOutput = '';

    if (desiredRelayStatusSlot) {

        const desiredRelayStatus = desiredRelayStatusSlot.value;
        sessionAttributes = createFavoriteRelayStatusAttributes(desiredRelayStatus);
        speechOutput = "The light has been turned " + desiredRelayStatus;
        repromptText = "You can ask me if the light is on or off by saying, is the light on or off?";

        /*
         * Update AWS IoT
        */
        // Determine relay postition within shadow
        if (desiredRelayStatus === 'on') {shadowRelayStatus = true;}
        var payloadObj={ "state": { "desired": { "RelayState": shadowRelayStatus } } };

        //Prepare the parameters of the update call
        var paramsUpdate = {

          "thingName" : config.IOT_THING_NAME,
          "payload" : JSON.stringify(payloadObj)

        };

        // Update IoT Device Shadow
        iotData.updateThingShadow(paramsUpdate, function(err, data) {

          if (err){
            console.log(err); // Handle any errors
          }
          else {
            console.log(data);
          }

        });

    }
    else {

        speechOutput = "I'm not sure if you want the light on or off. Please try again.";
        repromptText = "I'm not sure if you want the light on or off. You can tell me if you " +
            'want the light on or off by saying, turn the light on';

    }

    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));

}

function getRelayStatusFromSession(intent, session, callback) {

    let desiredRelayStatus;
    const repromptText = null;
    const sessionAttributes = {};
    let shouldEndSession = false;
    let speechOutput = '';

    if (session.attributes) {
        desiredRelayStatus = session.attributes.desiredRelayStatus;
    }

    if (desiredRelayStatus) {
        speechOutput = `You turned the light ${desiredRelayStatus}. Congratulations!`;
        shouldEndSession = true;
    }
    else {
        speechOutput = "I'm not sure if you want the light on or off, you can say, turn the light " +
            ' on';
    }

    // Setting repromptText to null signifies that we do not want to reprompt the user.
    // If the user does not respond or says something that is not understood, the session
    // will end.
    callback(sessionAttributes, buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession));

}

/* --------- end: Functions that control the skill's behavior --------------- */


/* ----------------------------- Events ------------------------------------- */

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {

    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);

}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {

    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'RelayStatusIsIntent') {setRelayStatusInSession(intent, session, callback);}
    else if (intentName === 'WhatsRelayStatusIntent') {getRelayStatusFromSession(intent, session, callback);}
    else if (intentName === 'AMAZON.HelpIntent') {getWelcomeResponse(callback);}
    else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {handleSessionEndRequest(callback);}
    else {throw new Error('Invalid intent');}

}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {

    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    // Add cleanup logic here

}

/* --------------------------- end: Events ---------------------------------- */


/* -------------------------- Main handler ---------------------------------- */

// Route the incoming request based on type (LaunchRequest, IntentRequest, etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {

    try {

        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        /*
        if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
             callback('Invalid Application ID');l
        }
        */

        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        }
        else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        }
        else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }

    }
    catch (err) {callback(err);}

};

/* ----------------------- end: Main handler -------------------------------- */

