import time


def main() -> None:
    while True:
        print("ai-scheduler ready; recurring AI jobs will be triggered here", flush=True)
        time.sleep(300)


if __name__ == "__main__":
    main()
