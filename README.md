# Video Notes

An opinionated local tool for turning timestamped notes into a shareable annotated video.

```txt
Drop Video
Write Notes
Preview
Export
Share
```

Rendering runs in the browser with WebCodecs. Mediabunny handles MP4/MOV container parsing while the browser's native codec pipeline decodes and encodes the annotated frames. The local Node server only serves static files; videos are not uploaded to the server and exports are saved through the browser download flow.

Export requires a browser with WebCodecs and H.264 encoding support, such as a current Chrome or Edge release.

## Run

```sh
npm install
npm run start
```

Open `http://127.0.0.1:5173`.

## Notes

```txt
default: 1

3.2 Button doesn't work.
4 Please change this.
6 2 Looks strange.
```

`time text` uses the default duration.

`time duration text` uses an explicit duration.

Use `default: next` to keep each note visible until the next note starts.

## Docker

```sh
docker compose up --build
```

Open `http://127.0.0.1:3011`.
