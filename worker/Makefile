.PHONY: up down logs build shell scrape apply test

up:        ; docker compose up -d --build
down:      ; docker compose down
logs:      ; docker compose logs -f worker
build:     ; docker compose build
shell:     ; docker compose exec worker bash
scrape:    ; docker compose exec worker python -m app.cli scrape
apply:     ; docker compose exec worker python -m app.cli apply 5
test:      ; docker compose exec worker python -m app.cli selftest
