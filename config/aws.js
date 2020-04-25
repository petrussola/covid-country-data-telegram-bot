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
const uploadFile = (file, count) => {
    const base64Data = new Buffer.from(file.replace(/^data:image\/\w+;base64,/, ""), 'base64');
	const params = {
		Bucket: awsBucketName,
		Key: `graph${count}`,
        Body: base64Data,
        ACL: 'public-read',
		ContentEncoding: 'base64',
		ContentType: `image/png`,
	};

	s3.upload(params, function (err, data) {
		if (err) {
			throw err;
		}
		console.log(`File uploaded successfully. ${data.Location}`);
	});
};

module.exports = uploadFile;
