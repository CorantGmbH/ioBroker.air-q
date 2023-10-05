import * as utils from '@iobroker/adapter-core';
import axios from 'axios';
import bonjour, { BrowserConfig } from 'bonjour-service';
import * as dns from 'dns';
import { decrypt } from './decryptAES256';

class AirQ extends utils.Adapter {
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
			await this.setObjectNotExistsAsync('Sensors', {
				type: 'device',
				common: {
					name: this.config.shortId.concat('_air-Q'),
				},
				native: {},
			});
		}catch(error){
			this.log.error(error);
		}

		await this.setObjectNotExistsAsync(`Sensors.Health`, {
			type: 'state',
			common: {
				name: 'Health',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`Sensors.Performance`, {
			type: 'state',
			common: {
				name: 'Performance',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});

		const service = await this.findAirQInNetwork(this.config.shortId.concat('_air-q'));
		const ip = await this.getIp(service.name);
		const sensorArray = await this.getSensorsInDevice(ip, this.config.password);

		for (const element of sensorArray) {
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
			await this.setStates(ip, sensorArray);
		}, this.config.retrievalRate * 1000);
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
			}, 30000);
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

	private async getDataFromAirQ(ip: string, password: string): Promise<any> {
		try {
			const response = await axios.get(`http://${ip}/data`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, password) as unknown;
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

	private async getAverageDataFromAirQ(ip: string, password: string): Promise<any> {
		try {
			const response = await axios.get(`http://${ip}/average`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, password) as unknown;
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

	private async getSensorsInDevice(ip: string, password: string): Promise<string[]> {
		try {
			const response = await axios.get(`http://${ip}/config`, { responseType: 'json' });
			const data = response.data.content;
			const decryptedData = decrypt(data, password) as unknown;
			if (decryptedData && typeof decryptedData === 'object') {
				const sensorsData = decryptedData as DataConfig;
				const sensors = sensorsData.sensors;
				return sensors;
			} else {
				throw new Error('DecryptedData is undefined or not an object');
			}
		} catch (error) {
			throw error;
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

	private async setStates(ip: string, sensorArray: string[]): Promise<void> {
		this.getRetrievalType() === 'data'
			? this.setSensorData(ip, sensorArray)
			: this.setSensorAverageData(ip, sensorArray);
		this.onStateChange('Sensors.Health', await this.getStateAsync('Sensors.Health'));
		this.onStateChange('Sensors.Performance', await this.getStateAsync('Sensors.Performance'));
		for (const element of sensorArray) {
			const state = await this.getStateAsync(`Sensors.${element}`);
			this.onStateChange(`Sensors.${element}`, state);
		}
	}

	private async setSensorData(ip: string, sensorArray: string[]): Promise<void> {
		const data = await this.getDataFromAirQ(ip, this.config.password);
		for (const element of sensorArray) {
			this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
		}
		this.setStateAsync('Sensors.Health', { val: data.health / 10, ack: true });
		this.setStateAsync('Sensors.Performance', { val: data.performance / 10, ack: true });
	}

	private async setSensorAverageData(ip: string, sensorArray: string[]): Promise<void> {
		const data = await this.getAverageDataFromAirQ(ip, this.config.password);
		for (const element of sensorArray) {
			this.setStateAsync(`Sensors.${element}`, { val: data[element][0], ack: true });
		}
		this.setStateAsync('Sensors.Health', { val: data.health / 10, ack: true });
		this.setStateAsync('Sensors.Performance', { val: data.performance / 10, ack: true });
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AirQ(options);
} else {
	(() => new AirQ())();
}
