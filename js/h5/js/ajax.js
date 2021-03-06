(function () {
	cr.plugins_.AJAX = function(runtime) {
		this.runtime = runtime;
	}
	var isNWjs = false;
	var path = null;
	var fs = null;
	var nw_appfolder = "";
	var pluginProto = cr.plugins_.AJAX.prototype;
	pluginProto.Type = function (plugin) {
		this.plugin = plugin;
		this.runtime = plugin.runtime;
	};
	var typeProto = pluginProto.Type.prototype;
	typeProto.onCreate = function () {
	};
	pluginProto.Instance = function (type) {
		this.type = type;
		this.runtime = type.runtime;
		this.lastData = "";
		this.curTag = "";
		this.progress = 0;
		this.timeout = -1;
		isNWjs = this.runtime.isNWjs;
		if (isNWjs) {
			path = require("path");
			fs = require("fs");
			var process = window["process"] || nw["process"];
			nw_appfolder = path["dirname"](process["execPath"]) + "\\";
		}
	};
	var instanceProto = pluginProto.Instance.prototype;
	var theInstance = null;
	window["C2_AJAX_DCSide"] = function (event_, tag_, param_) {
		if (!theInstance)
			return;
		if (event_ === "success") {
			theInstance.curTag = tag_;
			theInstance.lastData = param_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, theInstance);
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, theInstance);
		}
		else if (event_ === "error") {
			theInstance.curTag = tag_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, theInstance);
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, theInstance);
		}
		else if (event_ === "progress") {
			theInstance.progress = param_;
			theInstance.curTag = tag_;
			theInstance.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnProgress, theInstance);
		}
	};
	instanceProto.onCreate = function () {
		theInstance = this;
	};
	instanceProto.saveToJSON = function () {
		return {"lastData": this.lastData};
	};
	instanceProto.loadFromJSON = function (o) {
		this.lastData = o["lastData"];
		this.curTag = "";
		this.progress = 0;
	};
	var next_request_headers = {};
	var next_override_mime = "";

	instanceProto.doRequest = function (tag_, url_, method_, data_) {
		if (this.runtime.isDirectCanvas) {
			AppMobi["webview"]["execute"]('C2_AJAX_WebSide("' + tag_ + '", "' + url_ + '", "' + method_ + '", ' + (data_ ? '"' + data_ + '"' : "null") + ');');
			return;
		}
		var self = this;
		var request = null;
		var doErrorFunc = function () {
			self.curTag = tag_;
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
		};
		var errorFunc = function () {
			if (isNWjs) {
				var filepath = nw_appfolder + url_;
				if (fs["existsSync"](filepath)) {
					fs["readFile"](filepath, {"encoding": "utf8"}, function (err, data) {
						if (err) {
							doErrorFunc();
							return;
						}
						self.curTag = tag_;
						self.lastData = data.replace(/\r\n/g, "\n")
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
					});
				}
				else
					doErrorFunc();
			}
			else
				doErrorFunc();
		};
		var progressFunc = function (e) {
			if (!e["lengthComputable"])
				return;
			self.progress = e.loaded / e.total;
			self.curTag = tag_;
			self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnProgress, self);
		};
		try {
			if (this.runtime.isWindowsPhone8)
				request = new ActiveXObject("Microsoft.XMLHTTP");
			else
				request = new XMLHttpRequest();
			console.log('ajax XMLHttpRequest request', request)
			request.onreadystatechange = function () {
				if (request.readyState === 4) {
					console.log('ajax onreadystatechange request.responseText')
					self.curTag = tag_;
					if (request.responseText)
						self.lastData = request.responseText.replace(/\r\n/g, "\n");		// fix windows style line endings
					else
						self.lastData = "";
					if (request.status >= 400) {
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
					}
					else {
						if ((!isNWjs || self.lastData.length) && !(!isNWjs && request.status === 0 && !self.lastData.length)) {
							self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
							self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
						}
					}
				}
			};
			if (!this.runtime.isWindowsPhone8) {
				request.onerror = errorFunc;
				request.ontimeout = errorFunc;
				request.onabort = errorFunc;
				request["onprogress"] = progressFunc;
			}
			request.open(method_, url_);
			console.log('ajax XMLHttpRequest url_', url_)
			if (!this.runtime.isWindowsPhone8) {
				if (this.timeout >= 0 && typeof request["timeout"] !== "undefined")
					request["timeout"] = this.timeout;
			}
			try {
				request.responseType = "text";
			} catch (e) {
			}
			if (data_) {
				if (request["setRequestHeader"] && !next_request_headers.hasOwnProperty("Content-Type")) {
					request["setRequestHeader"]("Content-Type", "application/x-www-form-urlencoded");
				}
			}
			if (request["setRequestHeader"]) {
				var p;
				for (p in next_request_headers) {
					if (next_request_headers.hasOwnProperty(p)) {
						try {
							request["setRequestHeader"](p, next_request_headers[p]);
						}
						catch (e) {
						}
					}
				}
				next_request_headers = {};
			}
			if (next_override_mime && request["overrideMimeType"]) {
				try {
					request["overrideMimeType"](next_override_mime);
				}
				catch (e) {
				}
				next_override_mime = "";
			}
			if (data_)
				request.send(data_);
			else
				request.send();
		}
		catch (e) {
			errorFunc();
		}
	}

	function Cnds() {
	};
	Cnds.prototype.OnComplete = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	Cnds.prototype.OnAnyComplete = function (tag) {
		return true;
	};
	Cnds.prototype.OnError = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	Cnds.prototype.OnAnyError = function (tag) {
		return true;
	};
	Cnds.prototype.OnProgress = function (tag) {
		return cr.equals_nocase(tag, this.curTag);
	};
	pluginProto.cnds = new Cnds();

	function Acts() {
	};
	Acts.prototype.Request = function (tag_, url_) {
		console.log('Acts.prototype Request')
		var self = this;
		if (this.runtime.isWKWebView && !this.runtime.isAbsoluteUrl(url_)) {
			this.runtime.fetchLocalFileViaCordovaAsText(url_,
				function (str) {
					self.curTag = tag_;
					self.lastData = str.replace(/\r\n/g, "\n");		// fix windows style line endings
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
				},
				function (err) {
					self.curTag = tag_;
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
					self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
				});
		}
		else {
			this.doRequest(tag_, url_, "GET");
		}
	};
	Acts.prototype.RequestFile = function (tag_, file_) {
		console.log('Acts.prototype RequestFile file_', file_)
		var self = this;
		// if(file_.indexOf('level2')) {
		// 	console.log('Acts.prototype RequestFile file_', file_)
		// 	var str = '{"c2array":true,"size":[496,3,1],"data":[[[391],[672],[2168]],[[390],[640],[2200]],[[389],[608],[2232]],[[388],[576],[2264]],[[387],[544],[2296]],[[386],[512],[2328]],[[385],[480],[2360]],[[384],[448],[2392]],[[383],[416],[2424]],[[382],[384],[2456]],[[381],[352],[2488]],[[380],[320],[2520]],[[379],[288],[2552]],[[378],[256],[2584]],[[377],[224],[2616]],[[376],[208],[2648]],[[375],[240],[2680]],[[374],[272],[2712]],[[373],[304],[2744]],[[372],[336],[2776]],[[371],[368],[2808]],[[370],[400],[2840]],[[369],[432],[2872]],[[368],[464],[2904]],[["gem"],[488.9289316856887],[2928.928931685689]],[[367],[496],[2936]],[[366],[528],[2968]],[[365],[560],[3000]],[[364],[592],[3032]],[[363],[624],[3064]],[[362],[656],[3096]],[[361],[688],[3128]],[[360],[720],[3160]],[["gem"],[724.4644658428459],[3164.464465842846]],[[359],[752],[3192]],[[358],[784],[3224]],[[357],[816],[3256]],[[356],[848],[3288]],[[355],[880],[3320]],[["gem"],[880.9289316856888],[3320.928931685689]],[[354],[912],[3352]],[[353],[944],[3384]],[[352],[976],[3416]],[[351],[1008],[3448]],[[350],[1040],[3480]],[[349],[1072],[3512]],[[348],[1104],[3544]],[[347],[1136],[3576]],[[346],[1168],[3608]],[["gem"],[1163.5355341571542],[3612.464465842846]],[["point"],[1160],[3616]],[[345],[1136],[3640]],[[344],[1104],[3672]],[[343],[1072],[3704]],[[342],[1040],[3736]],[[341],[1008],[3768]],[[340],[976],[3800]],[[339],[944],[3832]],[[338],[912],[3864]],[[337],[880],[3896]],[["gem"],[868.4644658428459],[3916.464465842846]],[["point"],[872],[3920]],[[336],[880],[3928]],[[335],[912],[3960]],[[334],[944],[3992]],[[333],[976],[4024]],[[332],[1008],[4056]],[["gem"],[1040],[4088]],[[331],[1040],[4088]],[["point"],[1035.5355341571571],[4092.464465842843]],[[330],[1008],[4120]],[[329],[976],[4152]],[[328],[944],[4184]],[[327],[912],[4216]],[["gem"],[907.5355341571571],[4220.464465842842]],[["point"],[908.464465842849],[4228.464465842849]],[[326],[928],[4248]],[[325],[960],[4280]],[[324],[992],[4312]],[[323],[1024],[4344]],[[322],[1056],[4376]],[["gem"],[1071.0710683143113],[4392.928931685688]],[["point"],[1067.5355341571542],[4396.464465842846]],[[321],[1056],[4408]],[[320],[1024],[4440]],[[319],[992],[4472]],[[318],[960],[4504]],[[317],[928],[4536]],[["gem"],[920.9289316856888],[4544.928931685688]],[["point"],[924.4644658428429],[4548.464465842842]],[[316],[944],[4568]],[[315],[976],[4600]],[[314],[1008],[4632]],[[313],[1040],[4664]],[[312],[1072],[4696]],[["gem"],[1080],[4704]],[[311],[1104],[4728]],[[310],[1136],[4760]],[[309],[1168],[4792]],[[308],[1200],[4824]],[[307],[1232],[4856]],[["point"],[1232],[4872]],[[306],[1216],[4888]],[[305],[1184],[4920]],[[304],[1152],[4952]],[[303],[1120],[4984]],[[302],[1088],[5016]],[[301],[1056],[5048]],[[300],[1024],[5080]],[[299],[992],[5112]],[[298],[960],[5144]],[["gem"],[955.5355341571557],[5148.464465842844]],[[297],[928],[5176]],[[296],[896],[5208]],[[295],[864],[5240]],[[294],[832],[5272]],[[293],[800],[5304]],[["gem"],[799.0710683143113],[5304.928931685688]],[[292],[768],[5336]],[[291],[736],[5368]],[[290],[704],[5400]],[[289],[672],[5432]],[["point"],[676.4644658428443],[5436.464465842844]],[[288],[704],[5464]],[[287],[736],[5496]],[[286],[768],[5528]],[["point"],[771.5355341571557],[5540.464465842844]],[[285],[752],[5560]],[["point"],[744],[5584]],[[284],[752],[5592]],[["point"],[760],[5616]],[[283],[752],[5624]],[["point"],[728.9289316856887],[5648.928931685688]],[[282],[736],[5656]],[[281],[768],[5688]],[[280],[800],[5720]],[["point"],[808],[5744]],[[279],[800],[5752]],[[278],[768],[5784]],[[277],[736],[5816]],[["point"],[724.4644658428459],[5836.464465842846]],[[276],[736],[5848]],[[275],[768],[5880]],[[274],[800],[5912]],[["point"],[799.0710683143097],[5912.92893168569]],[[273],[768],[5944]],[[272],[736],[5976]],[["point"],[712.9289316856903],[6000.92893168569]],[[271],[720],[6008]],[[270],[752],[6040]],[["point"],[771.5355341571557],[6068.464465842844]],[[269],[768],[6072]],[[268],[736],[6104]],[[267],[704],[6136]],[["gem"],[696],[6144]],[[266],[672],[6168]],[[265],[640],[6200]],[["gem"],[615.0710683143083],[6224.928931685692]],[[264],[608],[6232]],[[263],[576],[6264]],[[262],[544],[6296]],[[261],[512],[6328]],[[260],[480],[6360]],[[259],[448],[6392]],[["point"],[448],[6408]],[[258],[464],[6424]],[[257],[496],[6456]],[[256],[528],[6488]],[[255],[560],[6520]],[["point"],[571.5355341571557],[6540.464465842844]],[[254],[560],[6552]],[[253],[528],[6584]],[[252],[496],[6616]],[[251],[464],[6648]],[[250],[432],[6680]],[["point"],[408.9289316856888],[6704.928931685688]],[[249],[416],[6712]],[[248],[448],[6744]],[[247],[480],[6776]],[[246],[512],[6808]],[[245],[544],[6840]],[["point"],[536],[6848]],[[244],[512],[6872]],[[243],[480],[6904]],[[242],[448],[6936]],[[241],[416],[6968]],[["point"],[400.9289316856888],[6984.928931685688]],[[240],[416],[7000]],[[239],[448],[7032]],[["point"],[467.5355341571541],[7060.464465842846]],[[238],[464],[7064]],[[237],[432],[7096]],[[236],[400],[7128]],[["point"],[384.9289316856888],[7144.928931685688]],[[235],[400],[7160]],[[234],[432],[7192]],[["point"],[448],[7224]],[[233],[448],[7224]],[[232],[416],[7256]],[[231],[384],[7288]],[["point"],[376.9289316856888],[7296.928931685688]],[[230],[400],[7320]],[[229],[432],[7352]],[["gem"],[456.9289316856888],[7376.928931685688]],[[228],[464],[7384]],[[227],[496],[7416]],[[226],[528],[7448]],[["gem"],[544],[7464]],[[225],[560],[7480]],[[224],[592],[7512]],[["gem"],[616.9289316856887],[7536.928931685688]],[[223],[624],[7544]],[[222],[656],[7576]],[[221],[688],[7608]],[["point"],[691.5355341571557],[7620.464465842844]],[[220],[672],[7640]],[["point"],[664.9289316856887],[7648.928931685688]],[[219],[688],[7672]],[[218],[720],[7704]],[[217],[752],[7736]],[["point"],[760],[7760]],[[216],[752],[7768]],[["point"],[736.9289316856887],[7784.928931685688]],[[215],[752],[7800]],[[214],[784],[7832]],[[213],[816],[7864]],[[212],[848],[7896]],[["point"],[864],[7928]],[[211],[864],[7928]],[[210],[832],[7960]],[[209],[800],[7992]],[[208],[768],[8024]],[["point"],[756.4644658428443],[8044.464465842844]],[[207],[768],[8056]],[["point"],[779.5355341571557],[8076.464465842844]],[[206],[768],[8088]],[[205],[736],[8120]],[[204],[704],[8152]],[[203],[672],[8184]],[[202],[640],[8216]],[["point"],[632.9289316856887],[8224.928931685688]],[[201],[656],[8248]],[[200],[688],[8280]],[[199],[720],[8312]],[[198],[752],[8344]],[["gem"],[776.9289316856887],[8368.928931685688]],[[197],[784],[8376]],[[196],[816],[8408]],[[195],[848],[8440]],[[194],[880],[8472]],[[193],[912],[8504]],[["point"],[915.5355341571557],[8516.464465842844]],[[192],[896],[8536]],[[191],[864],[8568]],[["gem"],[835.5355341571541],[8596.464465842846]],[[190],[832],[8600]],[[189],[800],[8632]],[[188],[768],[8664]],[["gem"],[759.0710683143097],[8672.92893168569]],[[187],[736],[8696]],[[186],[704],[8728]],[[185],[672],[8760]],[[184],[640],[8792]],[[183],[608],[8824]],[["point"],[592.9289316856887],[8840.928931685688]],[[182],[608],[8856]],[[181],[640],[8888]],[[180],[672],[8920]],[[179],[704],[8952]],[[178],[736],[8984]],[["point"],[728],[8992]],[[177],[704],[9016]],[[176],[672],[9048]],[[175],[640],[9080]],[[174],[608],[9112]],[["point"],[592],[9144]],[[173],[592],[9144]],[[172],[624],[9176]],[[171],[656],[9208]],[[170],[688],[9240]],[["point"],[680],[9248]],[[169],[656],[9272]],[["point"],[648.9289316856887],[9280.928931685688]],[[168],[672],[9304]],[["point"],[672],[9320]],[[167],[656],[9336]],[[166],[624],[9368]],[[165],[592],[9400]],[[164],[560],[9432]],[["point"],[564.4644658428443],[9436.464465842844]],[[163],[592],[9464]],[[162],[624],[9496]],[["point"],[647.0710683143097],[9520.92893168569]],[[161],[640],[9528]],[[160],[608],[9560]],[[159],[576],[9592]],[["point"],[568.9289316856903],[9600.92893168569]],[[158],[592],[9624]],[[157],[624],[9656]],[["point"],[632],[9680]],[[156],[624],[9688]],[[155],[592],[9720]],[[154],[560],[9752]],[["point"],[564.4644658428443],[9756.464465842844]],[[153],[592],[9784]],[[152],[624],[9816]],[[151],[656],[9848]],[[150],[688],[9880]],[[149],[720],[9912]],[[148],[752],[9944]],[[147],[784],[9976]],[[146],[816],[10008]],[[145],[848],[10040]],[[144],[880],[10072]],[["point"],[879.0710683143105],[10072.92893168569]],[[143],[848],[10104]],[[142],[816],[10136]],[[141],[784],[10168]],[[140],[752],[10200]],[[139],[720],[10232]],[[138],[688],[10264]],[[137],[656],[10296]],[[136],[624],[10328]],[[135],[592],[10360]],[["point"],[584],[10384]],[[134],[592],[10392]],[[133],[624],[10424]],[[132],[656],[10456]],[[131],[688],[10488]],[["point"],[704],[10520]],[[130],[704],[10520]],[[129],[672],[10552]],[[128],[640],[10584]],[[127],[608],[10616]],[[126],[576],[10648]],[["gem"],[564.4644658428443],[10668.464465842844]],[["point"],[568],[10672]],[[125],[576],[10680]],[[124],[608],[10712]],[[123],[640],[10744]],[[122],[672],[10776]],[[121],[704],[10808]],[[120],[736],[10840]],[["point"],[728],[10848]],[[119],[704],[10872]],[[118],[672],[10904]],[[117],[640],[10936]],[[116],[608],[10968]],[["point"],[608],[10984]],[[115],[624],[11000]],[[114],[656],[11032]],[["gem"],[680.9289316856895],[11056.92893168569]],[[113],[688],[11064]],[[112],[720],[11096]],[["gem"],[752],[11128]],[[111],[752],[11128]],[[110],[784],[11160]],[[109],[816],[11192]],[[108],[848],[11224]],[[107],[880],[11256]],[[106],[912],[11288]],[["gem"],[931.5355341571549],[11316.464465842846]],[["point"],[931.5355341571549],[11316.464465842846]],[[105],[928],[11320]],[[104],[896],[11352]],[[103],[864],[11384]],[[102],[832],[11416]],[[101],[800],[11448]],[["gem"],[788.4644658428443],[11468.464465842844]],[["point"],[788.4644658428443],[11468.464465842844]],[[100],[800],[11480]],[[99],[832],[11512]],[[98],[864],[11544]],[[97],[896],[11576]],[[96],[928],[11608]],[["gem"],[927.0710683143113],[11608.928931685688]],[["point"],[923.5355341571557],[11612.464465842844]],[[95],[896],[11640]],[[94],[864],[11672]],[[93],[832],[11704]],[[92],[800],[11736]],[["gem"],[784],[11752]],[["point"],[784.9289316856903],[11752.928931685692]],[[91],[800],[11768]],[[90],[832],[11800]],[[89],[864],[11832]],[[88],[896],[11864]],[[87],[928],[11896]],[["gem"],[943.0710683143105],[11912.92893168569]],[["point"],[936],[11920]],[[86],[928],[11928]],[[85],[896],[11960]],[[84],[864],[11992]],[[83],[832],[12024]],[[82],[800],[12056]],[["gem"],[800.9289316856895],[12056.92893168569]],[["point"],[808],[12064]],[[81],[832],[12088]],[[80],[864],[12120]],[[79],[896],[12152]],[[78],[928],[12184]],[["gem"],[952],[12208]],[["point"],[947.5355341571557],[12212.464465842844]],[[77],[944],[12216]],[[76],[912],[12248]],[[75],[880],[12280]],[[74],[848],[12312]],[[73],[816],[12344]],[[72],[784],[12376]],[[71],[752],[12408]],[[70],[720],[12440]],[[69],[688],[12472]],[[68],[656],[12504]],[["gem"],[640.9289316856891],[12520.928931685688]],[["point"],[644.4644658428443],[12524.464465842844]],[[67],[656],[12536]],[[66],[688],[12568]],[[65],[720],[12600]],[[64],[752],[12632]],[["gem"],[784],[12664]],[[63],[784],[12664]],[["point"],[779.5355341571549],[12668.464465842846]],[[62],[752],[12696]],[[61],[720],[12728]],[[60],[688],[12760]],[[59],[656],[12792]],[["point"],[636.4644658428448],[12820.464465842844]],[["gem"],[640],[12824]],[[58],[640],[12824]],[[57],[672],[12856]],[[56],[704],[12888]],[[55],[736],[12920]],[[54],[768],[12952]],[["point"],[784],[12984]],[[53],[784],[12984]],[[52],[752],[13016]],[[51],[720],[13048]],[[50],[688],[13080]],[[49],[656],[13112]],[[48],[624],[13144]],[["point"],[624.9289316856896],[13144.928931685688]],[[47],[656],[13176]],[[46],[688],[13208]],[[45],[720],[13240]],[[44],[752],[13272]],[["point"],[760],[13296]],[[43],[752],[13304]],[[42],[720],[13336]],[[41],[688],[13368]],[[40],[656],[13400]],[[39],[624],[13432]],[["point"],[620.4644658428448],[13444.464465842844]],[[38],[640],[13464]],[[37],[672],[13496]],[[36],[704],[13528]],[[35],[736],[13560]],[["gem"],[764.4644658428451],[13588.464465842846]],[[34],[768],[13592]],[[33],[800],[13624]],[[32],[832],[13656]],[[31],[864],[13688]],[[30],[896],[13720]],[[29],[928],[13752]],[["point"],[920],[13760]],[[28],[896],[13784]],[[27],[864],[13816]],[[26],[832],[13848]],[[25],[800],[13880]],[["point"],[800],[13896]],[[24],[816],[13912]],[[23],[848],[13944]],[[22],[880],[13976]],[[21],[912],[14008]],[[20],[944],[14040]],[["point"],[947.5355341571552],[14052.464465842844]],[[19],[928],[14072]],[[18],[896],[14104]],[[17],[864],[14136]],[[16],[832],[14168]],[[15],[800],[14200]],[["point"],[796.4644658428448],[14212.464465842844]],[[14],[816],[14232]],[[13],[848],[14264]],[[12],[880],[14296]],[[11],[912],[14328]],[[10],[944],[14360]],[["point"],[947.5355341571552],[14372.464465842844]],[[9],[928],[14392]],[[8],[896],[14424]],[[7],[864],[14456]],[[6],[832],[14488]],[[5],[800],[14520]],[[4],[768],[14552]],[[3],[736],[14584]],[[2],[704],[14616]],[[1],[672],[14648]]]}'
		// 	self.curTag = tag_;
		// 	self.lastData = str.replace(/\r\n/g, "\n");		// fix windows style line endings
		// 	self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
		// 	self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
		// }else {
			if (this.runtime.isWKWebView) {
				this.runtime.fetchLocalFileViaCordovaAsText(file_,
					function (str) {
						self.curTag = tag_;
						self.lastData = str.replace(/\r\n/g, "\n");		// fix windows style line endings
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyComplete, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnComplete, self);
					},
					function (err) {
						self.curTag = tag_;
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnAnyError, self);
						self.runtime.trigger(cr.plugins_.AJAX.prototype.cnds.OnError, self);
					});
			}
			else {
				console.log('RequestFile doRequest')
				this.doRequest(tag_, file_, "GET");
			}
		// }
	};
	Acts.prototype.Post = function (tag_, url_, data_, method_) {
		this.doRequest(tag_, url_, method_, data_);
	};
	Acts.prototype.SetTimeout = function (t) {
		this.timeout = t * 1000;
	};
	Acts.prototype.SetHeader = function (n, v) {
		next_request_headers[n] = v;
	};
	Acts.prototype.OverrideMIMEType = function (m) {
		next_override_mime = m;
	};
	pluginProto.acts = new Acts();

	function Exps() {
	};
	Exps.prototype.LastData = function (ret) {
		ret.set_string(this.lastData);
	};
	Exps.prototype.Progress = function (ret) {
		ret.set_float(this.progress);
	};
	Exps.prototype.Tag = function (ret) {
		ret.set_string(this.curTag);
	};
	pluginProto.exps = new Exps();
})()