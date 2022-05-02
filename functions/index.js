'use strict';

const functions = require('firebase-functions');

const { dialogflow, Suggestions, Confirmation } = require("actions-on-google");
const app = dialogflow();

let locationListStatic = ['Mumbai', 'Chandigarh', 'Bangalore', 'Goa'];
let validSeatNumberRegex = "^[a-cA-C][1-6]$";


// Welcome intent 
app.intent("Default Welcome Intent", conv => {
    conv.add(`Hi, I am your travel planner. You can ask me to book your train tickets and hotel room. \n Quick suggestions:  \n`);
    conv.ask(new Suggestions(['Book a train ticket', 'Book a room']))
});


// Fallback intent 
app.intent("Default Fallback Intent", conv => {
    conv.add(`Hi, This a default fallback intent in fulfillment`);
});


// Travel intent
app.intent("Travel Intent", conv => {
    let parameters = conv.parameters;
    if(!isEmpty(parameters.origin) && !isEmpty(parameters.destination)){
        // ask for travel date
        askForTravelDate(conv);
    }else{
        if(isEmpty(parameters.origin)){
            // ask for origin 
            askForOrigin(conv);
        }else{
            // ask for destination
            askForDestination(conv)
        }
    }
});


// Seat selection followup intent
app.intent("Seat Selection", (conv, params, confirmation) => {
    if (confirmation == true) {
        // ask to select seat
        askToSelectSeat(conv);
    } else if (confirmation == false) {
        // assign random seat
        conv.contexts.input.travel_intent_dialog_context.parameters.seatNumber = 'A1';
        // ask for payment
        askForPayment(conv);
    }
})



function askForOrigin(conv){
    conv.data = {destination: "Delhi"};
    conv.add('What is the origin of train? \n Quick suggestions:  \n');
    conv.ask(new Suggestions(locationListStatic));
}


function askForDestination(conv){
    conv.add('What is the destination of train? \n Quick suggestions:  \n');
    conv.ask(new Suggestions(locationListStatic));
}


function askForTravelDate(conv){
    let travelDate = conv.parameters.travelDate;
    if(isEmpty(travelDate)){
        // ask for travel date
        conv.add('For when do you want to book the train tickets? \n Quick suggestions:  \n');
        conv.ask(new Suggestions(['Today', 'Tomorrow', '3 days after today', 'Enter date']));
    }else {
        if(isTrainAvailable(travelDate)){
            // ask for train class
            askForTrainClass(conv);
        }else {

        }
    }
}




function askForTrainClass(conv){
    if(isEmpty(conv.parameters.class)){
        conv.add('Which class do you want to travel? \n Quick suggestions: \n');
        conv.ask(new Suggestions(['EC', '1AC', '2AC', '3AC']));
    }else{
        conv.ask(new Confirmation("Do you want to select seat?"));
    }
}




function askToSelectSeat(conv){
    if(isEmpty(conv.parameters.seatNumber) || !isValidSeatNumber(conv.parameters.seatNumber)){
        conv.ask(`Awesome, please select your seat for train from ${conv.parameters.origin.city} to ${conv.parameters.destination.city}? 
        \n\n A| 1 2 3 4 5 6 \n B| 1 2 3 4 5 6 \n C| 1 2 3 4 5 6`);
    }else if(isValidSeatNumber(conv.parameters.seatNumber)){
        // ask for payment
        askForPayment(conv);
    }
}



function askForPayment(conv){
    if(conv.parameters.paymentStatus.toLowerCase() == 'payment completed'){
        // ask if they want to book room also
        askForRoomBooking(conv)
    }else{
        conv.add("Please complete payment by clicking here");
        conv.ask(new Suggestions("Payment Completed"));
    }
}


function askForRoomBooking(conv){
    if(isEmpty(conv.parameters.shouldBookRoom)){
        let bookingId = Math.floor((Math.random() * 100) + 1);
        conv.add(`Thank you for your payment! \n\n\n Your ticket has been booked and your booking id is ${bookingId}. \n\n Do you want to book hotel room also?`);
        conv.ask(new Suggestions(['yes', 'no']));
    }else if(conv.parameters.shouldBookRoom.toLowerCase() == 'yes'){
        // book room 
    }else if(conv.parameters.shouldBookRoom.toLowerCase() == 'no'){
        conv.close("Have a great journey :)");
    }
}



function isTrainAvailable(travelDate){
    return true;
}


function isValidSeatNumber(seatNumber){
    return RegExp(validSeatNumberRegex).test(seatNumber);
}


function isEmpty(val){
    return (val === undefined || val == null || val.length <= 0) ? true : false;
}


exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);

// defult url - https://us-central1-nagp-demo-travel-planner-hiuc.cloudfunctions.net/dialogflowFirebaseFulfillment