const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require("./routes/indexRouter");
const blkRouter = require("./routes/blockRouter");
const accountRouter = require("./routes/accountRouter");
const txRouter = require("./routes/txRouter");
const kafkaRouter = require("./routes/kafkaRouter");
const nodeRouter = require("./routes/nodeRouter");

const setter = require('./src/Setter.js');
const db = require('./src/DBUtil.js');

const init = async () => {
    await setter.init();
    await db.init();
}

init();

// for cross domain (BE)
const allowCORS = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    (req.mothoed === 'OPTIONS') ?
        res.send(200) :
        next();
};

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json({ limit : "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(allowCORS);

app.use('/', indexRouter);
app.use('/block', blkRouter);
app.use('/account', accountRouter);
app.use('/tx', txRouter);
app.use('/kafka', kafkaRouter);
app.use('/node', nodeRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
