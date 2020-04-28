const AWS = require('aws-sdk');

// AWS

// AWS variables
const awsAccessKey = process.env.AWS_ACCESS_KEY_ID;
const awsSecretKey = process.env.AWS_SECRET_KEY;
const awsBucketName = process.env.AWS_BUCKET_NAME;

// S3 instance
const s3 = new AWS.S3({
	accessKeyId: awsAccessKey,
	secretAccessKey: awsSecretKey,
});
// AWS file uploader
const uploadFile = async (file, country, date) => {
	// https://medium.com/@mayneweb/upload-a-base64-image-data-from-nodejs-to-aws-s3-bucket-6c1bd945420f
	const base64Data = new Buffer.from(
		file.replace(/^data:image\/\w+;base64,/, ''),
		'base64'
	);
	const params = {
		Bucket: awsBucketName,
		Key: `${date}${country}`,
		Body: base64Data,
		// ACL: 'public-read',
		ContentEncoding: 'base64',
		ContentType: `image/png`,
		// https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingMetadata.html#object-keys
		Metadata: { 'x-amz-meta-country': country, 'x-amz-meta-date': date },
	};
	try {
		// putObject returns Etag
		const { ETag } = await s3.putObject(params).promise();
		etag = ETag;
		console.log(`File uploaded successfully. Etag: ${etag}`);
	} catch (error) {
		throw error;
	}
	return etag;
};

module.exports = uploadFile;
