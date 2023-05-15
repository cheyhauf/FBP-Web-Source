
exports.respondNoResourceFound = (req, res) => {
    let errorCode = 404;
    res.status(errorCode);
    res.send(`${errorCode} | The page does not exist!`);
};
exports.respondInternalError = (error, req, res, next) => {
    let errorCode = 502;
    console.log(`ERROR occurred: ${error.stack}`)
    res.status(errorCode);
    res.send(`${errorCode} | Sorry, the application experiencing a problem!`);
};