import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import bonjour, { BrowserConfig } from 'bonjour-service';
import * as dns from 'dns';
import { decrypt } from './decryptAES256';

class AirQ extends utils.Adapter {

	private _service: any;
	private _ip: string = '';
	private _sensorArray:string[]= [];
	private _id: string= '';
	private _password: string= '';
	private _deviceName: string = '';
	private _stateInterval: any;
	private _timeout: any;


	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'air-q',
		});
		axios.defaults.timeout = 4000;
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private onUnload(): void {
		this.log.info('AirQ adapter stopped...');
		this.clearInterval(this._stateInterval);
		this.clearTimeout(this._timeout);
	}

	private async onReady(): Promise<void> {
		await this.setObjectNotExistsAsync('connection', {
			type: 'state',
			common: {
				name: 'connection',
				type: 'boolean',
				role: 'info.connection',
				read: true,
				write: false,
			},
			native: {},
		});

		this.setState('connection', { val: false, ack: true });
		if(this.config.password){
			try{
				this.password = this.config.password;
				await this.checkConnectIP();

			}catch(error){
				this.log.error(error);
			}

			await this.setObjectNotExistsAsync('Sensors', {
				type: 'device',
				common: {
					name: this.deviceName,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`Sensors.health`, {
				type: 'state',
				common: {
					name: 'health',
					type: 'number',
					role: 'value',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`Sensors.performance`, {
				type: 'state',
				common: {
					name: 'performance',
					type: 'number',
					role: 'value',
					read: true,
					write: false,
				},
				native: {},
			});

			this.sensorArray = await this.getSensorsInDevice();
			for (const element of this.sensorArray) {
				if(element === 'temperature'){
					await this.setObjectNotExistsAsync(this.replaceInvalidChars(`Sensors.${element}`), {
						type: 'state',
						common: {
							name: element,
							type: 'number',
							role: this.setRole(element),
							unit: '°C',
							read: true,
							write: false,
						},
						native: {},
					});

				}
				await this.setObjectNotExistsAsync(this.replaceInvalidChars(`Sensors.${element}`), {
					type: 'state',
					common: {
						name: element,
						type: 'number',
						role: this.setRole(element),
						read: true,
						write: false,
					},
					native: {},
				});

			}

			this._stateInterval = this.setInterval(async () => {
				await this.setStates();
			}, this.retrievalRate * 1000);
		}
	}

	private setRole(element: string): string {
		switch (element) {
			case 'temperature':
				return 'value.temperature';
			case 'dewpt':
				return 'value.temperature';
			case 'humidity':
				return 'value.humidity';
			case 'pressure':
				return 'level.pressure';
			case 'co2':
				return 'value.co2';
			default:
				return 'value';
		}
	}

	private async checkConnectIP(): Promise<void> {
		try{
			if(this.config.connectViaIP){
				this.service= '';
				this.isValidIP(this.config.deviceIP);
				this.id = await this.getShortId()
			}else{
				this.id = this.config.shortId;
				this.deviceName = this.id.concat('_air-q');
				this.service = await this.findAirQInNetwork();
				this.ip= await this.getIp();
			}
		}catch(error){
			throw error;
		}
	}

	private isValidIP(ip: string): void {
		const ip4Address = /^(\d{1,3}\.){3}\d{1,3}$/;
		try{
			if(ip4Address.test(ip)){
				this.ip = this.config.deviceIP;
			}
		}catch(error){
			throw error;
		}
	}

	private async findAirQInNetwork(): Promise<any> {
		return new Promise((resolve, reject) => {
			const instance = new bonjour();
			const config: BrowserConfig = { type: 'http' };

			const findAirQ = instance.find(config, (service) => {
				if (service.name === this.deviceName) {
					findAirQ.stop();
					this.setState('connection', { val: true, ack: true });
					resolve(service);
				}
			});

			this._timeout= this.setTimeout(() => {
				findAirQ.stop();
				reject(new Error('AirQ not found in network'));
			}, 50000);
		});
	}

	private async getShortId(): Promise<string> {
		try{
			const response = await axios.get(`http://${this.ip}/config`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as DataConfig;
				const serial = sensorsData.SN;
				const shortID = serial.slice(0,5);
				this.setState('connection', { val: true, ack: true });
				return shortID;
			} else {
				throw new Error('DecryptedData is undefined or not an object');
			}
		}
		catch(error){
			throw error;
		}
	}

	private async getIp(): Promise<string> {
		try{
			return new Promise<string>((resolve, reject) => {
				dns.lookup(this.service.name, 4, (err, address) => {
					if (err) {
						reject(err);
					} else {
						resolve(address);
					}
				});
			});
		}catch(error){
			throw error;
		}
	}

	private async getDataFromAirQ(): Promise<any> {
		try {
			const response = await axios.get(`http://${this.ip}/data`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as Sensors;
				return sensorsData;
			} else {
				throw new Error('DecryptedData is undefined or not an object');
			}
		} catch(error){
			this.log.error('Error while getting data from AirQ: ' + error);
		}
	}

	private async getAverageDataFromAirQ(): Promise<any> {
		try {
			const response = await axios.get(`http://${this.ip}/average`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as Sensors;
				return sensorsData;
			} else {
				throw new Error('DecryptedData is undefined or not an object');
			}
		} catch (error) {
			this.log.error('Error while getting average data from AirQ: ' + error);
		}
	}

	private async getSensorsInDevice(): Promise<string[]> {
		try {
			const response = await axios.get(`http://${this.ip}/config`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, this.password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as DataConfig;
				const sensors = this.checkParticulates(sensorsData.sensors);
				return sensors;
			} else {
				throw new Error('DecryptedData is undefined or not an object');
			}
		} catch (error) {
			this.log.error('Error while getting sensors from device: ' + error);
		}
	}

	private checkParticulates(data:string[]): string[]{
		if (data.includes('particulates')){
			const pm=['pm1','pm2_5','pm10'];
			const index = data.indexOf('particulates');
			data.splice(index, 1);
			data.splice(index, 0, ...pm);
			return data;
		}else{
			return data;
		}
	}

	private getRetrievalType(): string {
		return this.config.retrievalType;
	}

	private async setStates(): Promise<void> {
		try{
			this.getRetrievalType() === 'data'
				? await this.setSensorData()
				: await this.setSensorAverageData();
		}catch(error){
			this.log.error('Error while setting states: ' + error);
		}
	}

	private async setSensorData(): Promise<void> {
		try{
			const data = await this.getDataFromAirQ();
			for (const element of this.sensorArray) {
				if(this.config.rawData){
					const isNegative = this.checkNegativeValues(data, element);
					const cappedValue= isNegative? 0 : data[element][0];
					await this.setStateAsync(this.replaceInvalidChars(`Sensors.${element}`), { val: cappedValue, ack: true});
				}else{
					await this.setStateAsync(this.replaceInvalidChars(`Sensors.${element}`), { val: data[element][0], ack: true });
				}
			}
			this.setStateAsync('Sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('Sensors.performance', { val: data.performance / 10, ack: true });
		}catch(error){
			this.log.error('Error while setting data from AirQ: ' + error);
		}
	}

	private async setSensorAverageData(): Promise<void> {
		try{
			const data = await this.getAverageDataFromAirQ();
			for (const element of this.sensorArray) {
				if(this.config.rawData){
					const isNegative = this.checkNegativeValues(data, element);
					const cappedValue= isNegative? 0 : data[element][0];
					await this.setStateAsync(this.replaceInvalidChars(`Sensors.${element}`), { val: cappedValue, ack: true});
				}else{
					await this.setStateAsync(this.replaceInvalidChars(`Sensors.${element}`), { val: data[element][0], ack: true });
				}
			}
			this.setStateAsync('Sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('Sensors.performance', { val: data.performance / 10, ack: true });
		}catch(error){
			this.log.error('Error while setting average data from AirQ: ' + error);
		}
	}

	private checkNegativeValues(data:Sensors, element:string): boolean {
		if(data[element][0]< 0 && element !== 'temperature'){
			return true;
		}else{
			return false;
		}
	}

	private replaceInvalidChars(name: string): string {
		return name.replace(this.FORBIDDEN_CHARS, '_');
	}

	set service(value: any) {
		this._service = value;
	}

	get service(): any {
		return this._service;
	}

	set ip(value: string) {
		this._ip = value;
	}

	get ip(): string {
		return this._ip;
	}

	set sensorArray(value: string[]) {
		this._sensorArray = value;
	}

	get sensorArray(): string[] {
		return this._sensorArray;
	}

	set id(value: string) {
		this._id = value;
	}

	get id(): string {
		return this._id;
	}

	set password(value: string) {
		this._password = value;
	}

	get password(): string {
		return this._password;
	}

	set deviceName(value: string) {
		this._deviceName = value;
	}

	get deviceName(): string {
		return this._deviceName;
	}

	get retrievalRate(): number {

		if(this.config.retrievalRate > 3600){
			return 3600;
		}else if(this.config.retrievalRate < 2){
			return 2;
		}else{
			return this.config.retrievalRate;
		}
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AirQ(options);
} else {
	(() => new AirQ())();
}
