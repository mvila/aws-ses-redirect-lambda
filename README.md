# aws-ses-redirect-lambda

JavaScript AWS Lambda function to redirect SES incoming messages.

## SES email receiving rule

Configure a rule as following:

Recipient: info@example.com

Actions:

1.  S3 action:
    - S3 bucket: example-aws-ses-redirect-lambda
2.  Lambda action:
    - Lambda function: aws-ses-rediret-lambda
    - Invocation type: Event

## S3 Bucket

Create a bucket with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPuts",
      "Effect": "Allow",
      "Principal": {
        "Service": "ses.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::<BUCKET_NAME>/*",
      "Condition": {
        "StringEquals": {
          "aws:Referer": "<AWS_ACCOUNT_ID>"
        }
      }
    }
  ]
}
```

## Lambda function

Create a Node.js >=8.10 Lambda function with `index.js` code and 30 secs timeout.

Specify the 'AWS_SES_REDIRECT_LAMBDA_CONFIG' environmment variable as following:

```
{"s3BucketName":"example-aws-ses-redirect-lambda","redirections":[{"recipient":"info@example.com","from":"redirect@example.com","to":"email@domain.com"}]}
```

## IAM role

Create an IAM role for the Lambda function with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::*/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

## License

MIT
