# delphea-cli: a ranking tool 
Delphea is a tool I made to help my analysis paralysis that affects me due to my ADHD. Inspired by the pokemon favorites picker, with delphea you create *sheets* of *activities* that you then rank by choosing your favorites from a randomized list. I find it really helpful! 

I have plans to make a web app of this eventually, but for now it's a simple but powerful cli program. I personally recommend using it on a remote server you ssh to, rather than using it locally.

## Installation

install using `npm i delphea-cli -g`

After that, the help message and just using the main menu should be enough to start you off.

## Usage
First, create your sheets. A sheet is a list of activities you want to do, such as games to play, books to read, etc. Run `delphea add -s` to start,

Next, create some activities to add to the sheet you just made. I recommend giving them different colors. You can do this by going `delphea add` or just `delphea a`

Once you've added a good number of activities to the sheet, rank your activities to discover what you want to do most! Run `delphea rank <sheetname>` where `<sheetname>` is the name of your sheet!

Finally, display your sheet with `delphea list <sheetname>`and look at your current ranking!

To display the top 5 of a sheet, run `delphea top` or `delphea t` 
