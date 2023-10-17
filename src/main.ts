import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import bonjour, { BrowserConfig } from 'bonjour-service';
import * as dns from 'dns';
import { decrypt } from './decryptAES256';

class AirQ extends utils.Adapter {

	private _service: any;
	private _ip: string;
	private _sensorArray:string[];
	private _id: string;
	private _password: string;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'air-q',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
	}

	private async onReady(): Promise<void> {

		try{
			this.id = this.config.shortId;
			this.password = this.config.password;
		}catch(error){
			this.log.error(error);
		}

		await this.setObjectNotExistsAsync('Sensors', {
			type: 'device',
			common: {
				name: this.id.concat('_air-Q'),
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
				write: true,
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
				write: true,
			},
			native: {},
		});

		try{
			this.service = await this.findAirQInNetwork(this.id.concat('_air-q'));
			this.ip = await this.getIp(this.service.name);
			this.sensorArray = await this.getSensorsInDevice();

			for (const element of this.sensorArray) {
				await this.setObjectNotExistsAsync(`Sensors.${element}`, {
					type: 'state',
					common: {
						name: element,
						type: 'number',
						role: 'value',
						read: true,
						write: true,
					},
					native: {},
				});

				 this.subscribeStates(`Sensors.${element}`);
			}

			this.setInterval(async () => {
				await this.setStates();
			}, this.config.retrievalRate * 1000);
		}catch(error){
			this.log.error(error);
			this.common!.enabled = false;
		}
	}

	private async findAirQInNetwork(airQName: string): Promise<any> {
		return new Promise((resolve, reject) => {
			const instance = new bonjour();
			const config: BrowserConfig = { type: 'http' };

			const findAirQ = instance.find(config, (service) => {
				if (service.name === airQName) {
					findAirQ.stop();
					resolve(service);
				}
			});

			setTimeout(() => {
				findAirQ.stop();
				reject(new Error('AirQ not found in network'));
				this.common!.enabled = false;
			}, 50000);
		});
	}

	private async getIp(service: any): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			dns.lookup(service, 4, (err, address) => {
				if (err) {
					reject(err);
				} else {
					resolve(address);
				}
			});
		});
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
		} catch{
			this.log.error('Error while getting data from AirQ');
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
			throw error;
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
			throw error;
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

	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		const value = state?.val;
		if (state) {
			this.getStateAsync(id, { val: value, ack: true });
		} else {
			this.log.info(`State ${id} deleted`);
		}
	}

	private async setStates(): Promise<void> {
		try{
			this.getRetrievalType() === 'data'
				? this.setSensorData(this.ip, this.sensorArray)
				: this.setSensorAverageData(this.ip, this.sensorArray);
			this.onStateChange('Sensors.health', await this.getStateAsync('Sensors.health'));
			this.onStateChange('Sensors.performance', await this.getStateAsync('Sensors.performance'));
			for (const element of this.sensorArray) {
				const state = await this.getStateAsync(`Sensors.${element}`);
				this.onStateChange(`Sensors.${element}`, state);
			}
		}catch{
			this.log.error('Error while setting states');
		}
	}

	private async setSensorData(ip: string, sensorArray: string[]): Promise<void> {
		try{
			const data = await this.getDataFromAirQ();
			for (const element of sensorArray) {
				this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
			}
			this.setStateAsync('Sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('Sensors.performance', { val: data.performance / 10, ack: true });
		}catch{
			this.log.error('Error while setting data from AirQ');
		}
	}

	private async setSensorAverageData(ip: string, sensorArray: string[]): Promise<void> {
		try{
			const data = await this.getAverageDataFromAirQ();
			for (const element of sensorArray) {
				this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
			}
			this.setStateAsync('Sensors.health', { val: data.health / 10, ack: true });
			this.setStateAsync('Sensors.performance', { val: data.performance / 10, ack: true });
		}catch{
			this.log.error('Error while setting average data from AirQ');
		}
	}
	set service(value: any) {
		try{
			this._service = value;
		}catch{
			this.log.error('Error while setting service');
		}
	}

	get service(): any {
		return this._service;
	}

	set ip(value: string) {
		try{
			this._ip = value;
		}catch{
			this.log.error('Error while setting ip');
		}
	}

	get ip(): string {
		return this._ip;
	}

	set sensorArray(value: string[]) {
		try{
			this._sensorArray = value;
		}catch{
			this.log.error('Error while setting sensorArray');
		}
	}

	get sensorArray(): string[] {
		return this._sensorArray;
	}

	set id(value: string) {
		try{
			this._id = value;
		}catch{
			this.log.error('Error while setting id. Check your instance settings.');
		}
	}

	get id(): string {
		return this._id;
	}

	set password(value: string) {
		try{
			this._password = value;
		}catch{
			this.log.error('Error while setting password. Check your instance settings.');
		}
	}

	get password(): string {
		return this._password;
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AirQ(options);
} else {
	(() => new AirQ())();
}
