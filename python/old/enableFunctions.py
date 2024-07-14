from iMISutils import enableProgramItems
from sys import argv, exit

if len(argv) < 2 or len(argv) > 3:
    print "Require event id [disable]"
    exit(1)

if argv[2] == "disable":
    print "Disabling functions for", argv[1]
else:
    print "Enabling functions for", argv[1]
    enableProgramItems(argv[1])
