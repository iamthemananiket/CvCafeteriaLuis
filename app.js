/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

//const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;
const LuisModelUrl = 'https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/8c146977-6399-4711-a469-d835c620173d?subscription-key=2c6dbb1d93a64f269280982933c6711d&spellCheck=true&bing-spell-check-subscription-key=d147867f01814c41b806742a2a2a5fb1&verbose=true&timezoneOffset=330&q='

// Main dialog with LUIS
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

//Default dialog
bot.dialog('/', [
    function(session) {
        //Greet user
        builder.Prompts.text(session, 'Hi! How can I help you?');
    },
    function (session, results) {
        session.endDialog('Thanks and goodbye!');
    }
]);

//Taxi.Book dialog
bot.dialog('BookTaxi', [
    function(session, args, next) {
        //Resolve and store taxi booking details
        var dropLocation = builder.EntityRecognizer.findEntity(
            args.intent.entities,
            'Taxi.PlaceName'
        );
        
        var dropTime = builder.EntityRecognizer.findEntity(
            args.intent.entities,
            'builtin.datetimeV2.time'
        );
        
        var dropData = session.dialogData.dropData = {
            dropLocation: dropLocation ? dropLocation.entity : null,
            dropTime: dropTime ? dropTime.entity : null
        };
        
        if (dropLocation && dropTime) {
            //Drop place and time detected
            next();
        } else if (!dropData.dropLocation) {
            builder.Prompts.text(session, "Drop location?");
        }
        else {
            next();
        }
    },
    function (session, results, next) {
        var dropData = session.dialogData.dropData;
        if (results.response) {
            dropData.dropLocation = results.response;
        }
        if(!dropData.dropTime) {
            builder.Prompts.time(session, "Drop time?");
        }
        else {
            next();
        }
    },
    function (session, results, next) {
        var dropData = session.dialogData.dropData;
        if(results.response) {
            dropData.dropTime = builder.EntityRecognizer.resolveTime([results.response]);
        }
        if(dropData.dropLocation && dropData.dropTime) {
            builder.Prompts.text(session, "Reason for late work?");
        }
        else {
            session.replaceDialog('BookTaxi');
        }
    },
    function (session, results, next) {
        var dropData = session.dialogData.dropData;
        if(results.response) {
            var workReason = session.dialogData.workReason = results.response;
        }
        if (dropData.dropLocation && dropData.dropTime) {
            builder.Prompts.confirm(
                session,
                `You'd like to book a cab\nTo: ${dropData.dropLocation}\nAt: ${dropData.dropTime}\n\nAm I right?`
            );
        }
    },
    function (session, results, next) {
        if(results.response) {
            session.endDialog(
                "Your cab has been successfully booked"
            );
        }
        else {
            session.replaceDialog('BookTaxi');
        }
    }
]).triggerAction({
    matches: 'Taxi.Book'
});

//Taxi.Cancel dialog
bot.dialog('CancelTaxi', [
    function(session, args, next) {
        //Resolve and store taxi booking details
        builder.Prompts.confirm(session, "You'd like to cancel your cab. Right?");
    },
    function (session, results, next) {
        if(results.response) {
            session.endDialog(
                "The cab has been successfully cancelled"
            );
        }
        else {
            session.replaceDialog('CancelTaxi');
        }
    }
]).triggerAction({
    matches: 'Taxi.Cancel'
});

//Dinner.Request dialog
bot.dialog('RequestDinner', [
    function (session, args, next) {
        //Collect late work reason
        builder.Prompts.text(session, "Reason for late work?");
    },
    function (session, results, next) {
        if(results.response) {
            session.endDialog(
                "You dinner request has been accepted"
            );
        }
        else {
            session.replaceDialog('RequestDinner');
        }
    }
]).triggerAction({
    matches: 'Dinner.Request'
});

var lunchMenu = {
    "Idly Vada - 55/-": {
        Restaurant: "Sri Krishna Bhavan",
        Price: 55
    },
    "Aloo Paratha - 60/-": {
        Restaurant: "Punjabi Khazana",
        Price: 60
    },
    "Chicken Biryani - 80/-": {
        Restaurant: "Hyderabad Biryani",
        Price: 80
    }
};

//Lunch.Enquire dialog
bot.dialog('EnquireLunch', [
    function (session, args, next) {
        //Resolve and store Lunch order details
        console.log(args);
        if (args) {
            var lunchDish = builder.EntityRecognizer.findEntity(
                args.intent.entities,
                'Lunch::Dish'
            );
            
            var lunchRestaurant = builder.EntityRecognizer.findEntity(
                args.intent.entities,
                'Lunch::Restaurant'
            );
            console.log(lunchDish, lunchRestaurant);
        }
        builder.Prompts.choice(
            session,
            "Here's the menu - ",
            lunchMenu,
            { listStyle: 3 }
        );
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]).triggerAction({
    matches: 'Lunch.Enquire'
});

//Lunch.Order dialog
bot.dialog('OrderLunch', [
    function(session, args, next) {
        //Resolve and store Lunch order details
        var lunchDish = builder.EntityRecognizer.findEntity(
            args.intent.entities,
            'Lunch::Dish'
        );
        
        var lunchRestaurant = builder.EntityRecognizer.findEntity(
            args.intent.entities,
            'Lunch::Restaurant'
        );
        
        var lunchData = session.dialogData.lunchData = {
            lunchDish: lunchDish ? lunchDish.entity : null,
            lunchRestaurant: lunchRestaurant ? lunchRestaurant.entity : null
        };
        
        console.log(lunchData);
        
        if (!(lunchDish || lunchRestaurant)) {
            session.beginDialog('EnquireLunch');
            console.log(lunchData);
            next();
        }
        
        if (lunchDish && lunchRestaurant) {
            //restaurant and dish detected
            next();
        } else {
            next();
        }
    },
    function (session, results, next) {
        var lunchData = session.dialogData.lunchData;
        if (results.response) {
            lunchData.lunchDish = results.response.entity;
            console.log(lunchData.lunchDish);
            lunchData.lunchRestaurant = lunchMenu[results.response.entity].Restaurant;
        }
        if(!lunchData.lunchRestaurant) {
            builder.Prompts.text(session, "Which restaurant you'd like to order from?");
        }
        else {
            next();
        }
    },
    function (session, results, next) {
        var lunchData = session.dialogData.lunchData;
        if(results.response) {
            lunchData.lunchRestaurant = results.response;
        }
        if(!lunchData.lunchDish) {
            session.Prompts.text(session, "What dish want to order?");
        }
        else {
            next();
        }
    },
    function (session, results, next) {
        var lunchData = session.dialogData.lunchData;
        if(results.response) {
            lunchData.lunchDish = results.response;
        }
        if (lunchData.lunchDish && lunchData.lunchRestaurant) {
            builder.Prompts.confirm(
                session,
                `You'd like to order lunch\n\nFrom: ${lunchData.lunchRestaurant}\nDish: ${lunchData.lunchDish}\n\nAm I right?`
            );
        }
    },
    function (session, results, next) {
        if(results.response) {
            session.endDialog(
                "Your lunch order has been successfully placed."
            );
        }
        else {
            session.replaceDialog('OrderLunch');
        }
    }
]).triggerAction({
    matches: 'Lunch.Order'
});
