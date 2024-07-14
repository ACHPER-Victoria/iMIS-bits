import json
from os.path import expanduser, join
home = expanduser("~")

SETTINGS = json.load(open(join(home, ".iMIS.json"), "rb"))
SITE_NAME = SETTINGS["SITE_NAME"]
API_URL = SETTINGS["API_URL"]
