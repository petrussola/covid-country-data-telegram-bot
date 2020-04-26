const AWS = require('aws-sdk');

// AWS

// AWS variables
const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AWS_SECRET_KEY;
const awsBucketName = process.env.AWS_BUCKET_NAME;

const s3 = new AWS.S3({
	accessKeyId: awsAccessKey,
	secretAccessKey: awsSecretKey,
});
// AWS file uploader
const uploadFile = async (file, count, country, date) => {
	const base64Data = new Buffer.from(
		file.replace(/^data:image\/\w+;base64,/, ''),
		'base64'
	);
	const params = {
		Bucket: awsBucketName,
		Key: `${date}${country}`,
		Body: base64Data,
		ContentEncoding: 'base64',
		ContentType: `image/png`,
		Metadata: { 'x-amz-meta-country': country, 'x-amz-meta-date': date },
	};
	try {
		const result = await s3.putObject(params).promise();
		location = Location;
		console.log(`File uploaded successfully. ${location}`);
	} catch (error) {
		throw error;
	}
	return location;
};

module.exports = uploadFile;
