'use strict';

const functions = require('firebase-functions');
const { WebhookClient, Suggestion } = require('dialogflow-fulfillment');
const fetch = require('node-fetch');

let locationSuggestions = ['Mumbai', 'Chandigarh', 'Bengaluru'];
let dateSuggestions = ['Today', 'Tomorrow', '3 days after today', 'Enter date'];


process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });



    // Welcome intent 
    function welcome() {
        agent.add("Hi, I am your travel planner. You can ask me to book your train tickets and hotel room. \n Quick suggestions:  \n");
        agent.add(new Suggestion("Book a train ticket"));
        agent.add(new Suggestion("Book a room"));
    }




    // Fallback intent 
    function fallback() {
        agent.add(`I didn't understand. I'm sorry, can you try again?`);
    }



    // Travel intent handler
    function travelIntentHandler() {
        let parameters = agent.parameters;
        if (!isEmpty(parameters.origin) && !isEmpty(parameters.destination)) {
            // ask for travel date
            agent.setFollowupEvent("travel_date")
        } else {
            if (isEmpty(parameters.origin)) {
                // ask for origin 
                return askForOrigin(agent);
            } else {
                // ask for destination
                askForDestination(agent)
            }
        }
    }



    // Travel date intent handler
    function travelDateIntentHandler() {
        let travelDate = agent.parameters.travelDate;
        if (isEmpty(travelDate)) {
            // ask for travel date
            agent.add('For when do you want to book the train tickets? \n Quick suggestions:  \n');
            dateSuggestions.forEach(date => agent.add(new Suggestion(date)));
        } else {
            if (isTrainAvailable(travelDate)) {
                // ask for train class
                agent.add('Which class do you want to travel? \n Quick suggestions: \n');
                let trainClass = ['EC', '1AC', '2AC', '3AC'];
                trainClass.forEach(trainClass => agent.add(new Suggestion(trainClass)));
            } else {
                agent.add("No trains are available for tomorrow");
                agent.add(new Suggestion("Change date"));
                agent.add(new Suggestion("Change destination"));
                agent.add(new Suggestion("Start over"));
            }
        }
    }



    // Select seat intent handler
    function selectSeatIntentHandler() {
        agent.setFollowupEvent('confirm_seat');
    }


    // Do not select seat intent handler
    function doNotSelectSeatIntentHandler() {
        agent.setFollowupEvent('do_payment');
    }



    // Confirm seat intent handler
    function confirmSeatIntentHandler() {
        let travelDateContext = agent.getContext("traveldate-followup");
        let origin = travelDateContext.parameters.origin.city;
        if(isEmpty(origin)){
            origin = travelDateContext.parameters.origin
        }
        if (isEmpty(agent.parameters.seatNumber)) {
            agent.add(`Please select your seat for your train from ${origin} to ${travelDateContext.parameters.destination.city} for ${travelDateContext.parameters.class}.`);
            agent.add("A| 1 2 3 4 5 6 \n B| 1 2 3 4 5 6 \n C| 1 2 3 4 5 6");
        } else {
            agent.setFollowupEvent('do_payment');
        }
    }



    // Travel intent fallback handler
    function travelIntentFallbackHandler() {
        switch (agent.query) {
            case 'Change date':
                agent.setFollowupEvent('travel_date');
                break;
            case 'Start over':
                agent.setFollowupEvent('start_over');
                break;
            case 'Change destination':
                let origin = agent.getContext('travelintent-followup').parameters.origin.city;
                agent.setFollowupEvent({
                    name: 'change_destination',
                    parameters: {
                        origin: origin,
                    },
                    languageCode: 'en',
                });
                break;
        }
    }



    // Travel class intent handler
    function travelClassIntentHandler() {
        agent.add("Do you want to select seat? \n");
        agent.add(new Suggestion("yes"));
        agent.add(new Suggestion("no"));
    }



    // Travel payment intent handler
    function travelPaymentIntentHandler() {
        if (agent.parameters.paymentStatus == 'Payment completed') {
            let bookingId = Math.floor((Math.random() * 1000) + 1);
            agent.add(`Thank you for your payment! \n\n\n Your tickets have been booked and your booking ID is ${bookingId}`);
            agent.add('Do you want to book hotel rooms also?');
            agent.add(new Suggestion('Yes'));
            agent.add(new Suggestion('No'));
        } else {
            agent.add('Please complete payment by clicking here');
            agent.add(new Suggestion('Payment completed'));
        }
    }



    // Book room - yes intent handler 
    function bookRoomIntentHandler() {
        agent.setFollowupEvent('select_hotel');
    }



    // Book room - no intent handler 
    function doNotBookRoomIntentHandler() {
        agent.add('Have a great journey :)');
    }



    // Room booking intent handler
    function confirmRoomBookingIntentHandler() {
        if (isEmpty(agent.parameters.destination)) {
            agent.setFollowupEvent('change_room_destination');
        } else {
            // ask for destination confirmation
            let context = agent.getContext("travelintent-followup");
            agent.add(`Do you want to book room for  ${context.parameters.destination.city}?`);
            agent.add(new Suggestion('Yes'));
            agent.add(new Suggestion('No'));
        }
    }



    // Destination Confirmed - no intent handler
    function changeRoomDestinationIntentHandler() {
        agent.setFollowupEvent('change_room_destination');
    }



    // Destination Confirmed - yes intent handler
    function doNotchangeRoomDestinationIntentHandler() {
        agent.setFollowupEvent('select_hotel');
    }




    // Change room booking detail intent handler
    function changeRoomBookingDetailIntentHandler() {
        if (isEmpty(agent.parameters.destination)) {
            agent.add('Please provide destination for room booking.');
            locationSuggestions.forEach(destination => agent.add(new Suggestion(destination)));
        } else if (isEmpty(agent.parameters.travelDate)) {
            agent.add('For when do you want to book the room?');
            agent.add(new Suggestion('Today'));
            agent.add(new Suggestion('Tomorrow'));
        } else {
            agent.setFollowupEvent('select_hotel');
        }
    }



    // Hotel detail intent handler
    function confirmHotelIntentHandler() {
        if (isEmpty(agent.parameters.hotelName)) {
            // ask for hotel name
            agent.add('Please select hotel from below available hotels.');
            ['Taj', 'Oberoi', 'Hilton'].forEach(hotel => agent.add(new Suggestion(hotel)));
        } else {
            // the end
            let context = agent.getContext("travelintent-followup");
            let date = getFormatedDate(context.parameters.travelDate);
            agent.add(`hotel booked for ${context.parameters.destination.city} for ${date}`);
        }
    }




    // Book a room intent handler
    function bookARoomIntentHandler(){
        if (isEmpty(agent.parameters.destination)) {
            agent.add('Please provide destination for room booking.');
            locationSuggestions.forEach(destination => agent.add(new Suggestion(destination)));
        } else if (isEmpty(agent.parameters.date)) {
            agent.add('For when do you want to book the room?');
            dateSuggestions.forEach(date => agent.add(new Suggestion(date)));
        } else if (isEmpty(agent.parameters.hotelName)) {
            // ask for hotel name
            agent.add('Please select hotel from below available hotels.');
            ['Taj', 'Oberoi', 'Hilton'].forEach(hotel => agent.add(new Suggestion(hotel)));
        } else {
            // the end
            let date = getFormatedDate(agent.parameters.date);
            agent.add(`hotel booked for ${agent.parameters.destination.city} for ${date}`);
        }
    }





    function askForOrigin() {
        return fetch("https://ipinfo.io/json").then(
            (response) => response.json()
        ).then(
            (json) => {
                agent.add('What is the origin of train? \n Quick suggestions:  \n');
                agent.add(new Suggestion(json.city))
                locationSuggestions.forEach(origin => agent.add(new Suggestion(origin)))
            }
        )
    }



    function askForDestination() {
        agent.add('What is the destination of train? \n Quick suggestions:  \n');
        let context = agent.getContext('travelintent-followup');
        let origin;
        if (isEmpty(context)) {
            origin = agent.parameters.origin.city;
        } else {
            origin = context.parameters.origin;
        }
        let destinationList = locationSuggestions.filter(destination => {
            if (origin != destination) {
                return destination;
            }
        })

        destinationList.forEach(destination => agent.add(new Suggestion(destination)));
    }




    function isTrainAvailable(travelDate) {
        let selectedTravelDate = new Date(travelDate);
        let tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        return selectedTravelDate.getDate() != tomorrowDate.getDate();
    }


    function getFormatedDate(date) {
        return new Date(date).toLocaleDateString()
    }



    function isEmpty(val) {
        return (val === undefined || val == null || val.length <= 0) ? true : false;
    }



    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('Start Over', welcome);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Travel Intent', travelIntentHandler);
    intentMap.set('Travel Date', travelDateIntentHandler);
    intentMap.set('Travel Class', travelClassIntentHandler);
    intentMap.set('Select Seat - yes', selectSeatIntentHandler);
    intentMap.set('Select Seat - no', doNotSelectSeatIntentHandler);
    intentMap.set('Confirm Seat', confirmSeatIntentHandler);
    intentMap.set('Travel Payment', travelPaymentIntentHandler);
    intentMap.set('Room Booking - yes', bookRoomIntentHandler);
    intentMap.set('Room Booking - no', doNotBookRoomIntentHandler);
    intentMap.set('Travel Intent - fallback', travelIntentFallbackHandler);
    intentMap.set('Room Booking', confirmRoomBookingIntentHandler);
    intentMap.set('Destination Confirmed - no', changeRoomDestinationIntentHandler);
    intentMap.set('Destination Confirmed - yes', doNotchangeRoomDestinationIntentHandler);
    intentMap.set('Room Booking Detail', changeRoomBookingDetailIntentHandler);
    intentMap.set('Hotel Detail', confirmHotelIntentHandler);
    intentMap.set('Book A Room', bookARoomIntentHandler);

    agent.handleRequest(intentMap);
});



// defult url - https://us-central1-nagp-demo-travel-planner-hiuc.cloudfunctions.net/dialogflowFirebaseFulfillment
// ngrok url - https://d200-2401-4900-1f3a-714-11a6-fc00-a7e0-1c11.in.ngrok.io/nagp-demo-travel-planner-hiuc/us-central1/dialogflowFirebaseFulfillment