// dependencies
const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');

// winston logger
const logger = winston.createLogger({
	level: 'info',
	format: winston.format.json(),
});

if (process.env.NODE_ENV === 'development') {
	const cloudWatchConfig = {
		logGroupName: process.env.CLOUDWATCH_GROUP_NAME,
		logStreamName: process.env.CLOUDWATCH_STREAM_NAME,
		awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
		awsSecretKey: process.env.AWS_SECRET_KEY,
		awsRegion: process.env.AWS_REGION,
		messageFormatter: ({ level, message, ...meta }) =>
			`[${level}]\n Success: ${meta.success}\n ${
				!meta.success ? `| Failure Message: ${meta.failureMessage}` : ''
			}\n | Text: ${message}\n | UserLanguage: ${meta.lang}\n | MessageId: ${
				meta.messageId
			}\n | IsBot: ${meta.isBot}]`,
	};
	logger.add(new WinstonCloudWatch(cloudWatchConfig));
} else {
	logger.add(new winston.transports.Console());
}

module.exports = logger;
