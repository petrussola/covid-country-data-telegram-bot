// DEPENDENCIES
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

// CHARTING
const chartExporter = require('highcharts-export-server');
// const Annotations = require('highcharts/modules/annotations');
// const Highcharts = require('highcharts'),
// 	HighchartsAnnotations = require('annotations')(Highcharts);

// HELPERS
const uploadFile = require('./config/aws');

// data
const { countries } = require('./data/countries');

// telegrapm api token
const token = process.env.TELEGRAM_TOKEN;
const baseApi = process.env.BASE_API;

let bot;

// initialize the chart exporter
chartExporter.initPool();
let count = 0;

// if production env, we use webhooks
// https://core.telegram.org/bots/api#setwebhook
// https://github.com/yagop/node-telegram-bot-api/blob/release/doc/api.md#TelegramBot+setWebHook
if (process.env.NODE_ENV === 'production') {
	bot = new TelegramBot(token);
	bot.setWebHook(process.env.HEROKU_URL + bot.token);
	console.log('**** BOT initiated ***** ');
} else {
	// otherwise, we use polling
	// differences between webhooks and polling:
	// https://core.telegram.org/bots/webhooks
	// https://stackoverflow.com/questions/40033150/telegram-bot-getupdates-vs-setwebhook
	bot = new TelegramBot(token, { polling: true });
}

console.log(`Bot started in the ${process.env.NODE_ENV} mode`);

bot.on('message', async (msg) => {
	console.log('########');
	console.log(msg);
	console.log('########');
	commands = ['/start', '/help'];
	const input = msg.text;
	// is user types /start or /help
	if (commands.includes(input)) {
		bot.sendMessage(
			msg.chat.id,
			`Welcome!\n
			- Type an ISO country code to get the latest COVID-19 official data i.e. Ireland => <b>ie</b>, France => <b>fr</b>, etc\n
			- Type <b>world</b> to get the latest global data`,
			{ parse_mode: 'HTML' }
		);
		// test file
	} else if (input === 'file') {
		bot.sendPhoto(msg.chat.id, './bar.png');
		// chartExporter.export(chartDetails, function (err, res) {
		// 	console.log(res);
		// 	//The export result is now in res.
		// 	//If the output is not PDF or SVG, it will be base64 encoded (res.data).
		// 	const image64 = res.data;
		// 	//If the output is a PDF or SVG, it will contain a filename (res.filename).
		// 	const outputFile = 'bar.png';

		// 	fs.writeFileSync(outputFile, image64, 'base64', (err) => {
		// 		if (err) {
		// 			console.log(err);
		// 		}
		// 	});
		// 	const filetest = `${__dirname}/bar.png`;
		// 	//Kill the pool when we're done with it, and exit the application
		// 	chartExporter.killPool();
		// 	// process.exit(1);
		// });
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
					].toLocaleString()} new].\n\nData source: Johns Hopkins University Center for Systems Science and Engineering.`,
					{ parse_mode: 'HTML' }
				);
				console.log(globalData);
			} catch (error) {}
		} else {
			country = countries.filter((item) => {
				return item['ISO2'] === countryCode.toUpperCase();
			});
			// if message sent does not match a country, return error message
			if (country.length === 0) {
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
						}${diffDeaths.toLocaleString()} new].\n\nData source: Johns Hopkins University Center for Systems Science and Engineering.`,
						{ parse_mode: 'HTML' }
					);
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
					console.log(dates);
					console.log(newConfirmed);
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
						// console.log(res);
						//The export result is now in res.
						//If the output is not PDF or SVG, it will be base64 encoded (res.data).
						const image64 = res.data;
						//If the output is a PDF or SVG, it will contain a filename (res.filename).
						// -----------------
						// const outputFile = `${__dirname}/charts/graph${count}.png`;

						// fs.writeFileSync(outputFile, image64, 'base64', (err) => {
						// 	if (err) {
						// 		console.log(err);
						// 	}
						// });
						// --------------
						// console.log(image64);
						try {
							const date = `${lastDay}${lastMonth}${lastYear}`
							const etag = await uploadFile(image64, count, countryName, date);
							count++;
							console.log(`***** count is: ${count} *******`);
							console.log(etag)
							bot.sendPhoto(msg.chat.id, location);
							//Kill the pool when we're done with it, and exit the application
							chartExporter.killPool();
							// process.exit(1);
						} catch (error) {
							console.log(error);
						}
					});
				} catch (error) {
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
