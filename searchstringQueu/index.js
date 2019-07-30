


var request = require('request');
var $ = require('cheerio')
const {
    Aborter,
    QueueURL,
    MessagesURL,
    MessageIdURL,
    ServiceURL,
    StorageURL,
    SharedKeyCredential
} = require('@azure/storage-queue')


// notice -- no async
module.exports = function (context, myQueueItem) {
    context.log('JavaScript QUEUE trigger(James1) --->', myQueueItem);
    doMyCode(context, myQueueItem)

}

// my simple method
function doMyCode(context, myQueueItem) {
    var urlLinks = []
    var URL = ""

    // 
    // check if I really have something or I was called out of the blue
    if (myQueueItem) {
        var str = myQueueItem.split(' ').join('%20')
        URL = `http://www.google.com/search?start=0&num=20&q=%22${str}%22`
        context.log("JAM---> URL-->", URL)
    } else {
        // if I was called out of the blue just return
        context.log("got junk: -- >", myQueueItem)
        return
    }

    //
    // do the communication with google
    request.get(URL, (error, respose, body) => {

        context.log("substring---->", body.substring(1, 30))

        //
        // take the google data and break it down
        //
        // adding each href to a list
        $('.jfp3ef', body).each((index, value) => {
            context.log("--->in the parser")
            var link = $(value).children().attr('href')
            if (typeof (link) === 'string') {
                var it = link.split('/url?q=')[1]
                urlLinks.push(it)
            }
        })
        //
        // now take those hrefs and blob 'em and queue 'em
        context.log("urllinks -->", urlLinks.length)
        if (urlLinks.length > 0) {
            var it = JSON.stringify(urlLinks)
            retData = {
                links: it,
                URL: URL
            }
            context.log("--->going for the blob write")
            context.bindings.outputblob = JSON.stringify(retData)

            const account = "jamqueue1b6bb";
            const accountKey = "<your_key here>";
            context.log("---> running 0...--->")
            // Use SharedKeyCredential with storage account and account key
            const sharedKeyCredential = new SharedKeyCredential(account, accountKey);
            context.log("running...--->")
            // Use sharedKeyCredential, tokenCredential or anonymousCredential to create a pipeline
            const pipeline = StorageURL.newPipeline(sharedKeyCredential, {
                retryOptions: { maxTries: 4 }, // Retry options
                telemetry: { value: "BasicSample V10.0.0" } // Customized telemetry string
            });
            context.log("---> running 2...")
            const serviceURL = new ServiceURL(
                `https://${account}.queue.core.windows.net`,
                pipeline
            );
            
            // Create a new queue
            context.log("creating the queue...")
            
            const queueName = 'sillyjamipoetqueue';
            const queueURL = QueueURL.fromServiceURL(serviceURL, queueName);
            const createQueueResponse = queueURL.create(Aborter.none);
            context.log(
                `Create queue ${queueName} successfully, service assigned request Id: ${createQueueResponse.requestId}`
            );

            //
            // lastly, loop and queue each link for download
            urlLinks.forEach((item, index) => {
                context.log(`---> queuing ${index} ...--->`, item)
                // Enqueue a message into the queue using the enqueue method.
                const messagesURL = MessagesURL.fromQueueURL(queueURL);
                //
                // got to have base64 encoding - not mentioned in the docs!
                const enqueueQueueResponse = messagesURL.enqueue(Aborter.none, Buffer.from(item).toString('base64'));
                context.log(
                    `Enqueue message successfully, link => ${item}`
                );
            })


        }
        context.log("processing complete!")
        // close up and return
        context.done()
    })

}
