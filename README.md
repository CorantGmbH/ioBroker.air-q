# ioBroker.air-q 
<img src="admin/air-q.png" alt="airq-logo" width="200"/>

[![NPM version](https://img.shields.io/npm/v/iobroker.air-q.svg)](https://www.npmjs.com/package/iobroker.air-q)
[![Downloads](https://img.shields.io/npm/dm/iobroker.air-q.svg)](https://www.npmjs.com/package/iobroker.air-q)
![Number of Installations](https://iobroker.live/badges/air-q-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/air-q-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.air-q.png?downloads=true)](https://nodei.co/npm/iobroker.air-q/)

**Tests:** ![Test and Release](https://github.com/CorantGmbH/ioBroker.air-q/workflows/Test%20and%20Release/badge.svg)
## About
This ioBroker Adapter is used in connection with our air-Q device. It polls the values from our sensors and displays them for you in the ioBroker environment. 
</br>
</br>

## Installation manual

### Prerequisites

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

### Getting started

Now you can install our adapter by using npm directly: 
```
npm install ioBroker.air-q
```

Or by using the discovery adapter provided by ioBroker. [PIC]

### Test the adapter manually with dev-server

If you'd like to debug the adapter yourself you can use dev-server. 
Once you installed it, run `dev-server setup`. 
You can use it to run, test and debug your adapter.

You may start `dev-server` by calling from your dev directory:
```
dev-server watch
```

The ioBroker.admin interface will then be available at http://localhost:8081/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* (Katharina K.) initial release

## License
MIT License

Copyright (c) 2023 Corant GmbH

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
