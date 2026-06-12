import time


def main() -> None:
    while True:
        print("ai-worker ready; queued AI jobs will be processed here", flush=True)
        time.sleep(60)


if __name__ == "__main__":
    main()
