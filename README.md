# dsh-plugin-vehicle-ui

A local DSH/Cordis tool for converting offline Figma `.fig` files into a platform-neutral vehicle UI intermediate representation and interactive H5 prototypes.

## Capabilities

- Parse `.fig` files offline with `openfig-core`.
- Enumerate Pages and large screen Frames.
- Extract source node ids, text, bounds, image references, colors and inferred control semantics.
- Emit `ui-ir.json` with Figma evidence, confidence scores and interaction records.
- Generate a generic browseable H5 for any selected Page.
- Generate the vehicle-settings H5 adapter for the `设置UI` Page.
- Export `interaction-contract.json` and `vehicle-ui.d.ts` for Android, Linux, Qt/QML or other native clients.
- Validate generated file sets.

## Local CLI

```powershell
cd D:\AI\dsh-vehicle-ui-tool
npm install
npm run check
node .\bin\vehicle-ui.mjs --op overview --fig 'D:\fig\锐胜M8交互.fig'
node .\bin\vehicle-ui.mjs --op inspect --fig 'D:\fig\锐胜M8交互.fig' --page '设置UI'
node .\bin\vehicle-ui.mjs --op generate-ir --fig 'D:\fig\锐胜M8交互.fig' --page '设置UI'
node .\bin\vehicle-ui.mjs --op generate-h5 --fig 'D:\fig\锐胜M8交互.fig' --page '设置UI' --target settings-h5 --out 'D:\锐胜M8设置UI交互-生成版'
node .\bin\vehicle-ui.mjs --op validate --fig 'D:\fig\锐胜M8交互.fig' --page '设置UI' --out 'D:\锐胜M8设置UI交互-生成版'
```

Open the generated `index.html` directly in a browser. The generated prototype is fixed to the design viewport and scales to fit the browser window.

## DSH tool

The package registers one model-facing tool named `vehicle_ui` when mounted in a DSH profile. Supported operations:

- `overview`: page and node inventory.
- `inspect`: screen frame inventory for one Page.
- `generate-ir`: UI-IR with source node ids and inferred interactions.
- `generate-h5`: generic H5 or `settings-h5` output.
- `validate`: generated file-set validation.

The core plugin entry is `lib/index.js` and exports a Cordis plugin shape:

```js
{
  name: 'vehicle-ui-tool',
  inject: ['tools'],
  apply(ctx) { ... }
}
```

The tool uses the host `fs` Service when it is available for reading input. Generated files are written only to the requested output directory.

## Interaction contract

Every generated screen exposes:

```js
window.VehicleUI.on('tap', listener)
window.VehicleUI.on('longPress', listener)
window.VehicleUI.on('dragMove', listener)
window.VehicleUI.on('valueChange', listener)
window.VehicleUI.registerAdapter('android', event => {})
window.VehicleUI.getState()
window.VehicleUI.setState('display.theme', '浅色')
```

The same event is also emitted as `window` event `vehicle-ui:event` and forwarded to these optional native bridges:

- `window.AndroidVehicleUI.postMessage(json)`
- `window.webkit.messageHandlers.vehicleUI.postMessage(event)`
- `window.vehicleUIBridge.postMessage(json)`

Each event carries `componentId`, `screenId`, `sourceNodeId`, `value`, `previousValue`, pointer data, phase and metadata. Long press and drag are implemented in the generated settings adapter; semantic inference for other pages is reported with a confidence score and requires review where no explicit Figma prototype metadata exists.

## Scope boundary

The current settings adapter is intentionally a vertical slice for `设置UI`: it implements the categories and labels found in the design file, and uses the seat image from the Figma asset map where available. It does not claim to connect to CAN, Android vehicle services or Linux IPC. Those integrations consume `VehicleUI` events and are the next adapter boundary.
