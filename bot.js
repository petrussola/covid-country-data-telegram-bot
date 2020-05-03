// DEPENDENCIES
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// CHARTING
const chartExporter = require('highcharts-export-server');

// HELPERS
const uploadFile = require('./config/aws');
const logger = require('./config/logger');

// data
const { countries } = require('./data/countries');

// telegrapm api token
const token = process.env.TELEGRAM_TOKEN;
const baseApi = process.env.BASE_API;

// aws bucket url
const awsBucketBaseURL = process.env.AWS_BUCKET_URL;

// initialize bot
let bot;

// cache of graphs
let cache = {};

// initialize the chart exporter
chartExporter.initPool();

// if production env, we use webhooks
// https://core.telegram.org/bots/api#setwebhook
// https://github.com/yagop/node-telegram-bot-api/blob/release/doc/api.md#TelegramBot+setWebHook
if (process.env.NODE_ENV === 'production') {
	bot = new TelegramBot(token);
	bot.setWebHook(process.env.HEROKU_URL + bot.token);
	console.log('**** BOT initiated ***** ');
	logger.info('Bot started', {
		success: true,
		successMessage: '**** BOT initiated *****',
		failureMessage: '',
		messageId: null,
		isBot: null,
		lang: null,
	});
} else {
	// otherwise, we use polling
	// differences between webhooks and polling:
	// https://core.telegram.org/bots/webhooks
	// https://stackoverflow.com/questions/40033150/telegram-bot-getupdates-vs-setwebhook
	bot = new TelegramBot(token, { polling: true });
}

console.log(`Bot started in the ${process.env.NODE_ENV} mode`);
logger.info('Bot started', {
	success: true,
	successMessage: `Bot started in the ${process.env.NODE_ENV} mode`,
	failureMessage: '',
	messageId: null,
	isBot: null,
	lang: null,
});

bot.on('message', async (msg) => {
	commands = ['/start', '/help'];
	const input = msg.text;
	// is user types /start or /help
	if (commands.includes(input)) {
		bot.sendMessage(
			msg.chat.id,
			`Welcome!\n
			- Type an ISO country code to get the latest COVID-19 official data i.e. Ireland => <b>ie</b>, France => <b>fr</b>, etc\n
			- Type <b>world</b> to get the latest global data\n
			- Type <b>/country</b> followed by the name of a country to find the ISO code. i.e. "<b>/country ireland</b>" will return "<b>IE</b>"\n\nLike this bot? Share the link: t.me/covidalerts_bot`,
			{ parse_mode: 'HTML', disable_web_page_preview: true }
		);
	} else if (input.includes('/country')) {
		const arg = input.split('/country')[1].trim();
		if (arg === '') {
			bot.sendMessage(
				msg.chat.id,
				"You can use the '/country' to find the ISO code of a country. Type '/country' followed by the name of the country and I will return you the ISO code, so you can do your search.\nFor example: '/country ireland' will return 'ie'\nLike this bot? Share the link: t.me/covidalerts_bot",
				{ disable_web_page_preview: true }
			);
		} else {
			const country = countries.filter((item) => {
				return item['Country'].toLowerCase().includes(arg.toLowerCase());
			});
			// no country was found containing the argument passed
			if (country.length === 0) {
				bot.sendMessage(
					msg.chat.id,
					`Hmm, <b>${arg}</b> doesn't seem to be a country name. Try again with another one.`,
					{ parse_mode: 'HTML' }
				);
				// a single country was found containing the argument passed
			} else if (country.length === 1) {
				bot.sendMessage(
					msg.chat.id,
					`The ISO code for <b>${country[0]['Country']}</b> is <b>${
						country[0]['ISO2']
					}</b>. You can now do your search by typing <b>${
						country[0]['ISO2']
					}</b> or <b>${country[0]['ISO2'].toLowerCase()}</b> in the bot.`,
					{ parse_mode: 'HTML' }
				);
				// more than one country was found containing the argument passed i.e. Korea
			} else {
				let answer = `We found more than one country matching the name your typed ("${arg}"): `;
				let names = [];
				for (i in country) {
					names.push(
						`${country[i]['Country']} with ISO code ${country[i]['ISO2']}`
					);
				}
				for (i in names) {
					if (i === '0') {
						answer += names[i];
					} else if (i === (names.length - 1).toString()) {
						answer += ` and ${names[i]}`;
					} else {
						answer += `, ${names[i]}`;
					}
				}
				bot.sendMessage(msg.chat.id, answer);
			}
		}
	} else {
		const countryCode = msg.text;
		// world data
		if (
			countryCode.toUpperCase() === 'WORLD' ||
			countryCode.toUpperCase() === 'GLOBAL'
		) {
			try {
				data = await axios.get(`${baseApi}/summary`);
				globalData = data.data.Global;
				bot.sendMessage(
					msg.chat.id,
					`Last <b>global</b> data available.\n\nConfirmed: ${globalData[
						'TotalConfirmed'
					].toLocaleString()} cases [${globalData[
						'NewConfirmed'
					].toLocaleString()} new].\nRecovered: ${globalData[
						'TotalRecovered'
					].toLocaleString()} cases [${globalData[
						'NewRecovered'
					].toLocaleString()} new].\nDeaths: ${globalData[
						'TotalDeaths'
					].toLocaleString()} cases [${globalData[
						'NewDeaths'
					].toLocaleString()} new].\n\nData source: Johns Hopkins University Center for Systems Science and Engineering.\n\nLike this bot? Share the link: t.me/covidalerts_bot`,
					{ parse_mode: 'HTML', disable_web_page_preview: true }
				);
			} catch (error) {
				logger.info(msg.text, {
					success: false,
					successMessage: '',
					failureMessage: `Telegram didn't deliver: ${error}`,
					messageId: msg.message_id,
					isBot: msg.from.is_bot,
					lang: msg.from.language_code,
				});
			}
		} else {
			country = countries.filter((item) => {
				return item['ISO2'] === countryCode.toUpperCase();
			});
			// if message sent does not match a country, return error message
			if (country.length === 0) {
				logger.info(msg.text, {
					success: false,
					successMessage: '',
					failureMessage: 'Wrong ISO code',
					messageId: msg.message_id,
					isBot: msg.from.is_bot,
					lang: msg.from.language_code,
				});
				bot.sendMessage(
					msg.chat.id,
					"The text you wrote doesn't seem to match an ISO country code. Please try another one."
				);
			} else {
				countryName = country[0]['Country'];
				try {
					// data from API
					// https://documenter.getpostman.com/view/10808728/SzS8rjbc?version=latest#9739c95f-ef1d-489b-97a9-0a6dfe2f74d8
					confirmed = await axios.get(
						`${baseApi}total/country/${countryName}/status/confirmed`
					);
					confirmedData = confirmed.data;
					recovered = await axios.get(
						`${baseApi}total/country/${countryName}/status/recovered`
					);
					recoveredData = recovered.data;
					death = await axios.get(
						`${baseApi}total/country/${countryName}/status/deaths`
					);
					deathData = death.data;
					// last and before last available data index
					lastDateIndex = confirmedData.length - 1;
					beforeLastDateIndex = confirmedData.length - 2;
					// we get the latest date available
					lastYear = confirmedData[confirmedData.length - 1]['Date'].substring(
						0,
						4
					);
					lastMonth = confirmedData[confirmedData.length - 1]['Date'].substring(
						5,
						7
					);
					lastDay = confirmedData[confirmedData.length - 1]['Date'].substring(
						8,
						10
					);
					diffConfirmed =
						confirmedData[lastDateIndex]['Cases'] -
						confirmedData[beforeLastDateIndex]['Cases'];
					diffRecovered =
						recoveredData[lastDateIndex]['Cases'] -
						recoveredData[beforeLastDateIndex]['Cases'];
					diffDeaths =
						deathData[lastDateIndex]['Cases'] -
						deathData[beforeLastDateIndex]['Cases'];
					bot.sendMessage(
						msg.chat.id,
						`Last data available for <b>${countryName}</b> is for <b>${lastDay}-${lastMonth}-${lastYear}</b>.\n\nConfirmed: ${confirmedData[
							lastDateIndex
						]['Cases'].toLocaleString()} cases [${
							diffConfirmed > 0 ? '+' : '-'
						}${diffConfirmed.toLocaleString()} new].\nRecovered: ${recoveredData[
							lastDateIndex
						]['Cases'].toLocaleString()} cases [${
							diffRecovered > 0 ? '+' : '-'
						}${diffRecovered.toLocaleString()} new].\nDeaths: ${deathData[
							lastDateIndex
						]['Cases'].toLocaleString()} cases [${
							diffDeaths > 0 ? '+' : '-'
						}${diffDeaths.toLocaleString()} new].\n\nData source: Johns Hopkins University Center for Systems Science and Engineering.\n\nLike this bot? Share the link: t.me/covidalerts_bot`,
						{ parse_mode: 'HTML', disable_web_page_preview: true }
					);
					logger.info(msg.text, {
						success: true,
						successMessage: `Text delivered`,
						failureMessage: '',
						messageId: msg.message_id,
						isBot: msg.from.is_bot,
						lang: msg.from.language_code,
					});
					// charting
					const dates = [];
					const newConfirmed = [];
					for (index in confirmedData) {
						if (confirmedData[index]['Cases'] !== 0) {
							if (index === '0') {
								dates.push(confirmedData[index]['Date'].substring(0, 10));
								newConfirmed.push(0);
							} else {
								dates.push(confirmedData[index]['Date'].substring(0, 10));
								newConfirmed.push(
									confirmedData[index]['Cases'] -
										confirmedData[index - 1]['Cases']
								);
							}
						}
					}
					// chart details
					const chartDetails = {
						type: 'png',
						options: {
							title: {
								text: `New Daily Confirmed Cases - ${countryName}`,
							},
							yAxis: {
								title: {
									text: 'New Daily Confirmed Cases',
								},
							},
							xAxis: {
								categories: dates,
							},
							series: [
								{
									type: 'line',
									data: newConfirmed,
								},
							],
							legend: {
								enabled: false,
							},
						},
					};
					chartExporter.export(chartDetails, async function (err, res) {
						//The export result is now in res.
						//If the output is not PDF or SVG, it will be base64 encoded (res.data).
						const image64 = res.data;
						const date = `${lastYear}${lastMonth}${lastDay}`;
						const countryLower = countryName.toLowerCase();
						// check if country is in the cache. If it is there, meanse we have generated file in s3 before, so we don't need to do it again
						if (!cache[`${date}${countryLower}`]) {
							try {
								logger.info(msg.text, {
									success: true,
									successMessage: `Chart not in cache. Attempting save in AWS`,
									failureMessage: '',
									messageId: msg.message_id,
									isBot: msg.from.is_bot,
									lang: msg.from.language_code,
								});
								// aws s3 file upload helper
								const etag = await uploadFile(image64, countryLower, date);
								// if file is saved in aws s3 bucket add it to cache
								if (etag) {
									logger.info(msg.text, {
										success: true,
										successMessage: `chart saved in AWS. Etag: ${etag}`,
										failureMessage: '',
										messageId: msg.message_id,
										isBot: msg.from.is_bot,
										lang: msg.from.language_code,
									});
									cache[`${date}${countryLower}`] = true;
									logger.info(msg.text, {
										success: true,
										successMessage: 'Chart saved in cache',
										failureMessage: '',
										messageId: msg.message_id,
										isBot: msg.from.is_bot,
										lang: msg.from.language_code,
									});
								}
							} catch (error) {
								logger.info(msg.text, {
									success: false,
									successMessage: '',
									failureMessage: 'When saving chart to AWS',
									messageId: msg.message_id,
									isBot: msg.from.is_bot,
									lang: msg.from.language_code,
								});
							}
						}
						let url = `${awsBucketBaseURL}${date}${countryLower}`;
						bot.sendPhoto(msg.chat.id, url);
						logger.info(msg.text, {
							success: true,
							successMessage: 'Chart delivered',
							failureMessage: '',
							messageId: msg.message_id,
							isBot: msg.from.is_bot,
							lang: msg.from.language_code,
						});
						//Kill the pool when we're done with it, and exit the application
						chartExporter.killPool();
						// process.exit(1);
					});
				} catch (error) {
					logger.info(msg.text, {
						success: false,
						successMessage: '',
						failureMessage: 'After text message & before chart',
						messageId: msg.message_id,
						isBot: msg.from.is_bot,
						lang: msg.from.language_code,
					});
					bot.sendMessage(
						msg.chat.id,
						'We could not fetch the data requested. Please try again.'
					);
				}
			}
		}
	}
});

module.exports = bot;
