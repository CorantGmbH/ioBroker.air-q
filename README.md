# ioBroker.air-q 
<img src="admin/air-q.png" alt="airq-logo" width="200"/>

[![NPM version](https://img.shields.io/npm/v/iobroker.air-q.svg)](https://www.npmjs.com/package/iobroker.air-q)
[![Downloads](https://img.shields.io/npm/dm/iobroker.air-q.svg)](https://www.npmjs.com/package/iobroker.air-q)
![Number of Installations](https://iobroker.live/badges/air-q-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/air-q-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.air-q.png?downloads=true)](https://nodei.co/npm/iobroker.air-q/)

**Tests:** ![Test and Release](https://github.com/CorantGmbH/ioBroker.air-q/workflows/Test%20and%20Release/badge.svg)

## Contents
- [About](#about)
- [Installation manual](#install)
	- [Prerequisites](#prereq)
 	- [Getting started](#start)
	- [Test the adapter manually with dev-server](#testing)
 - [Changelog](#change)
 - [License](#license)


## About <a id="about"/>
This ioBroker Adapter is used in connection with our [air-Q device](https://www.air-q.com). It polls the values from our sensors and displays them for you in the ioBroker environment. 
</br>
</br>

![air-Q_frontal + Seitlich_full](https://github.com/CorantGmbH/ioBroker.air-q/assets/107550719/5c38d737-9641-463f-bd07-ac62ce5f1973)

## Installation manual <a id="install" />

### Prerequisites <a id="prereq" />

Please make sure to install the newest version of npm. 
To install and update necessary dependencies please run 
```
npm i
```
 to ensure the adapter is running properly.
For development it is recommended to use dev-server, which you can install with:
```
npm install dev-server
```

### Getting started <a id="start" />

Head to your root directory for your ioBroker system. Now you can install our adapter by using npm directly: 
```
npm install iobroker.air-q
```

Once this is done, you should be able to find the adapter through the interface. To configure your instance you simply select whether you want to connect it through the IP or the short-ID of your device.

![Screenshot 2024-02-13 103001](https://github.com/CorantGmbH/ioBroker.air-q/assets/107550719/ec878783-af56-490d-af66-43c53c27df20)

Please make sure you enter the correct IP/ID and password. 
Then you can also choose how the data should be retrieved. You can clip negative values if you don't need them, with the exception of temperature, of course. You can set up how often the data should be polled by typing in the number in seconds. And lastly you can choose between realtime data or average data. 

![Screenshot 2024-02-13 104813](https://github.com/CorantGmbH/ioBroker.air-q/assets/107550719/429c57ab-933f-4930-a02b-30da7b5df180)

Now you should be all set up and good to go!

The data will be retrieved and shown in the objects-tab according to your configuration, when the device is found. Of course, depending on the device you own, there might be more sensors shown. 

![Screenshot 2024-02-13 110655](https://github.com/CorantGmbH/ioBroker.air-q/assets/107550719/5639fdcb-3acf-4223-b1fa-fb69016c9d7b)

***For now we have all sensors for the air-Q Pro included. Optional sensors will be included in a future patch.***


### Test the adapter manually with dev-server <a id="testing" />

If you'd like to debug the adapter yourself you can use dev-server. 
Once you installed it, run `dev-server setup`. 
You can use it to run, test and debug your adapter.

You may start `dev-server` by calling from your dev directory:
```
dev-server watch
```

The ioBroker.admin interface will then be available at http://127.0.0.1:8081/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Changelog <a id="change" />
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (Katharina K.) initial release

## License <a id="license"/>

MIT License

Copyright (c) 2024 Corant GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


Copyright (c) 2024 Corant GmbH
