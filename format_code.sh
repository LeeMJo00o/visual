#!/bin/bash
#!/bin/bash

is_change=false

ARGS=$(getopt -o '' -l change: -- "$@")
eval set -- "$ARGS"

while true; do
  case "$1" in
    --change)
      case "$2" in
        true)
          is_change=true
          ;;
        false)
          is_change=false
          ;;
        *)
          echo "Invalid value for --change: $2"
          exit 1
          ;;
      esac
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Invalid argument: $1"
      exit 1
      ;;
  esac
done

if [ "$is_change" = true ]; then
  echo "autopep8 use --in-place, replace all files"
  python3 -m autopep8        \
    -a -a \
    --recursive \
    --exclude='*_pb2*.py'   \
    --max-line-length 240  \
    --in-place                 \
    --recursive src
else
  echo "autopep8 use --diff"
  python3 -m autopep8        \
    -a -a \
    --recursive \
    --exclude='*_pb2*.py'   \
    --max-line-length 240  \
    --diff                 \
    --recursive src
fi
