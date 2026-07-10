# Video Notes

An opinionated local tool for turning timestamped notes into a shareable annotated video.

```txt
Drop Video
Write Notes
Preview
Export
Share
```

## Run

```sh
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
mkdir -p videos
docker compose up --build
```

Open `http://127.0.0.1:5175`.

In Docker, place videos in `videos` and use paths like `/videos/input.mp4`.
