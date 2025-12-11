declare global {
	interface Sensors {
		health: number;
		performance: number;
		temperature: number;
		humidity: number;
		humidity_abs: number;
		dewpt: number;
		co: number;
		co2: number;
		no2: number;
		o3: number;
		oxygen: number;
		so2: number;
		pm1: number;
		pm2_5: number;
		pm10: number;
		h2s: number;
		tvoc: number;
		ch2o: number;
		ch4: number;
		nh3: number;
		cl2: number;
		h2: number;
		c3h8: number;
		n2o: number;
		pressure: number;
		pressure_rel: number;
		sound: number;
		sound_max: number;
	}
	type Unit = '°C' | 'ppm' | 'ppb' | 'mg/m³' | 'µg/m³' | 'Bq/m³' | '%'| 'db(A)'| 'g/m³' | 'µm' | 'hPa';

	// Status can be "OK" or object with error messages
	type SensorStatus = 'OK' | Record<string, string>;

	// Complete device response structure
	type DeviceDataResponse = Sensors & {Status: SensorStatus}
}
export {};
