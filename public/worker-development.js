/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./worker/index.ts":
/*!*************************!*\
  !*** ./worker/index.ts ***!
  \*************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

eval(__webpack_require__.ts("/// <reference lib=\"webworker\" />\nconst sw = self;\nsw.addEventListener(\"push\", (event)=>{\n    if (!event.data) return;\n    try {\n        const data = event.data.json();\n        const options = {\n            body: data.body,\n            icon: \"/icons/icon-192.png\",\n            badge: \"/icons/icon-192.png\",\n            data: {\n                url: data.url || \"/dashboard\"\n            }\n        };\n        event.waitUntil(sw.registration.showNotification(data.title || \"KhelaHobe\", options));\n    } catch (e) {\n        console.error(\"Error showing push notification:\", e);\n    }\n});\nsw.addEventListener(\"notificationclick\", (event)=>{\n    event.notification.close();\n    event.waitUntil(sw.clients.matchAll({\n        type: \"window\",\n        includeUncontrolled: true\n    }).then((clientList)=>{\n        var _event_notification_data;\n        const url = ((_event_notification_data = event.notification.data) === null || _event_notification_data === void 0 ? void 0 : _event_notification_data.url) || \"/dashboard\";\n        for (const client of clientList){\n            if (client.url === url && \"focus\" in client) {\n                return client.focus();\n            }\n        }\n        if (sw.clients.openWindow) {\n            return sw.clients.openWindow(url);\n        }\n    }));\n});\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                /* unsupported import.meta.webpackHot */ undefined.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi93b3JrZXIvaW5kZXgudHMiLCJtYXBwaW5ncyI6IkFBQUEsaUNBQWlDO0FBRWpDLE1BQU1BLEtBQUtDO0FBRVhELEdBQUdFLGdCQUFnQixDQUFDLFFBQVEsQ0FBQ0M7SUFDM0IsSUFBSSxDQUFDQSxNQUFNQyxJQUFJLEVBQUU7SUFDakIsSUFBSTtRQUNGLE1BQU1BLE9BQU9ELE1BQU1DLElBQUksQ0FBQ0MsSUFBSTtRQUM1QixNQUFNQyxVQUFVO1lBQ2RDLE1BQU1ILEtBQUtHLElBQUk7WUFDZkMsTUFBTTtZQUNOQyxPQUFPO1lBQ1BMLE1BQU07Z0JBQUVNLEtBQUtOLEtBQUtNLEdBQUcsSUFBSTtZQUFhO1FBQ3hDO1FBQ0FQLE1BQU1RLFNBQVMsQ0FDYlgsR0FBR1ksWUFBWSxDQUFDQyxnQkFBZ0IsQ0FBQ1QsS0FBS1UsS0FBSyxJQUFJLGFBQWFSO0lBRWhFLEVBQUUsT0FBT1MsR0FBRztRQUNWQyxRQUFRQyxLQUFLLENBQUMsb0NBQW9DRjtJQUNwRDtBQUNGO0FBRUFmLEdBQUdFLGdCQUFnQixDQUFDLHFCQUFxQixDQUFDQztJQUN4Q0EsTUFBTWUsWUFBWSxDQUFDQyxLQUFLO0lBQ3hCaEIsTUFBTVEsU0FBUyxDQUNiWCxHQUFHb0IsT0FBTyxDQUFDQyxRQUFRLENBQUM7UUFBRUMsTUFBTTtRQUFVQyxxQkFBcUI7SUFBSyxHQUFHQyxJQUFJLENBQUMsQ0FBQ0M7WUFDM0R0QjtRQUFaLE1BQU1PLE1BQU1QLEVBQUFBLDJCQUFBQSxNQUFNZSxZQUFZLENBQUNkLElBQUksY0FBdkJELCtDQUFBQSx5QkFBeUJPLEdBQUcsS0FBSTtRQUM1QyxLQUFLLE1BQU1nQixVQUFVRCxXQUFZO1lBQy9CLElBQUlDLE9BQU9oQixHQUFHLEtBQUtBLE9BQU8sV0FBV2dCLFFBQVE7Z0JBQzNDLE9BQU8sT0FBZ0JDLEtBQUs7WUFDOUI7UUFDRjtRQUNBLElBQUkzQixHQUFHb0IsT0FBTyxDQUFDUSxVQUFVLEVBQUU7WUFDekIsT0FBTzVCLEdBQUdvQixPQUFPLENBQUNRLFVBQVUsQ0FBQ2xCO1FBQy9CO0lBQ0Y7QUFFSiIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi93b3JrZXIvaW5kZXgudHM/ZWNiZSJdLCJzb3VyY2VzQ29udGVudCI6WyIvLy8gPHJlZmVyZW5jZSBsaWI9XCJ3ZWJ3b3JrZXJcIiAvPlxuXG5jb25zdCBzdyA9IHNlbGYgYXMgdW5rbm93biBhcyBTZXJ2aWNlV29ya2VyR2xvYmFsU2NvcGU7XG5cbnN3LmFkZEV2ZW50TGlzdGVuZXIoJ3B1c2gnLCAoZXZlbnQ6IFB1c2hFdmVudCkgPT4ge1xuICBpZiAoIWV2ZW50LmRhdGEpIHJldHVybjtcbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gZXZlbnQuZGF0YS5qc29uKCk7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgIGJvZHk6IGRhdGEuYm9keSxcbiAgICAgIGljb246ICcvaWNvbnMvaWNvbi0xOTIucG5nJyxcbiAgICAgIGJhZGdlOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXG4gICAgICBkYXRhOiB7IHVybDogZGF0YS51cmwgfHwgJy9kYXNoYm9hcmQnIH1cbiAgICB9O1xuICAgIGV2ZW50LndhaXRVbnRpbChcbiAgICAgIHN3LnJlZ2lzdHJhdGlvbi5zaG93Tm90aWZpY2F0aW9uKGRhdGEudGl0bGUgfHwgJ0toZWxhSG9iZScsIG9wdGlvbnMpXG4gICAgKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNob3dpbmcgcHVzaCBub3RpZmljYXRpb246JywgZSk7XG4gIH1cbn0pO1xuXG5zdy5hZGRFdmVudExpc3RlbmVyKCdub3RpZmljYXRpb25jbGljaycsIChldmVudDogTm90aWZpY2F0aW9uRXZlbnQpID0+IHtcbiAgZXZlbnQubm90aWZpY2F0aW9uLmNsb3NlKCk7XG4gIGV2ZW50LndhaXRVbnRpbChcbiAgICBzdy5jbGllbnRzLm1hdGNoQWxsKHsgdHlwZTogJ3dpbmRvdycsIGluY2x1ZGVVbmNvbnRyb2xsZWQ6IHRydWUgfSkudGhlbigoY2xpZW50TGlzdCkgPT4ge1xuICAgICAgY29uc3QgdXJsID0gZXZlbnQubm90aWZpY2F0aW9uLmRhdGE/LnVybCB8fCAnL2Rhc2hib2FyZCc7XG4gICAgICBmb3IgKGNvbnN0IGNsaWVudCBvZiBjbGllbnRMaXN0KSB7XG4gICAgICAgIGlmIChjbGllbnQudXJsID09PSB1cmwgJiYgJ2ZvY3VzJyBpbiBjbGllbnQpIHtcbiAgICAgICAgICByZXR1cm4gKGNsaWVudCBhcyBhbnkpLmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzdy5jbGllbnRzLm9wZW5XaW5kb3cpIHtcbiAgICAgICAgcmV0dXJuIHN3LmNsaWVudHMub3BlbldpbmRvdyh1cmwpO1xuICAgICAgfVxuICAgIH0pXG4gICk7XG59KTtcbiJdLCJuYW1lcyI6WyJzdyIsInNlbGYiLCJhZGRFdmVudExpc3RlbmVyIiwiZXZlbnQiLCJkYXRhIiwianNvbiIsIm9wdGlvbnMiLCJib2R5IiwiaWNvbiIsImJhZGdlIiwidXJsIiwid2FpdFVudGlsIiwicmVnaXN0cmF0aW9uIiwic2hvd05vdGlmaWNhdGlvbiIsInRpdGxlIiwiZSIsImNvbnNvbGUiLCJlcnJvciIsIm5vdGlmaWNhdGlvbiIsImNsb3NlIiwiY2xpZW50cyIsIm1hdGNoQWxsIiwidHlwZSIsImluY2x1ZGVVbmNvbnRyb2xsZWQiLCJ0aGVuIiwiY2xpZW50TGlzdCIsImNsaWVudCIsImZvY3VzIiwib3BlbldpbmRvdyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///./worker/index.ts\n"));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			if (cachedModule.error !== undefined) throw cachedModule.error;
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/trusted types policy */
/******/ 	!function() {
/******/ 		var policy;
/******/ 		__webpack_require__.tt = function() {
/******/ 			// Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
/******/ 			if (policy === undefined) {
/******/ 				policy = {
/******/ 					createScript: function(script) { return script; }
/******/ 				};
/******/ 				if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
/******/ 					policy = trustedTypes.createPolicy("nextjs#bundler", policy);
/******/ 				}
/******/ 			}
/******/ 			return policy;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script */
/******/ 	!function() {
/******/ 		__webpack_require__.ts = function(script) { return __webpack_require__.tt().createScript(script); };
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/react refresh */
/******/ 	!function() {
/******/ 		if (__webpack_require__.i) {
/******/ 		__webpack_require__.i.push(function(options) {
/******/ 			var originalFactory = options.factory;
/******/ 			options.factory = function(moduleObject, moduleExports, webpackRequire) {
/******/ 				var hasRefresh = typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
/******/ 				var cleanup = hasRefresh ? self.$RefreshInterceptModuleExecution$(moduleObject.id) : function() {};
/******/ 				try {
/******/ 					originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
/******/ 				} finally {
/******/ 					cleanup();
/******/ 				}
/******/ 			}
/******/ 		})
/******/ 		}
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	
/******/ 	// noop fns to prevent runtime errors during initialization
/******/ 	if (typeof self !== "undefined") {
/******/ 		self.$RefreshReg$ = function () {};
/******/ 		self.$RefreshSig$ = function () {
/******/ 			return function (type) {
/******/ 				return type;
/******/ 			};
/******/ 		};
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval-source-map devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./worker/index.ts");
/******/ 	
/******/ })()
;