from urllib.request import urlopen
from html.parser import HTMLParser

class TableParser(HTMLParser):
   def __init__(self):
      super().__init__()
      self.rows=[]
      self.row=None
      self.cell=None

   def handle_starttag(self,tag,attrs):
      if tag=="tr":
          self.row=[]
      elif tag in("td","th") and self.row is not None:
          self.cell=""

   def handle_endtag(self,tag):
      if tag in ("td","th") and self.row is not None:
          self.row.append(self.cell.strip())
          self.cell=None
      elif tag=="tr" and self.row is not None:
          self.rows.append(self.row)
          self.row=None

   def handle_data(self,data):
      if self.cell is not None:
          self.cell+=data

def decode_secret_msg(url):
      with urlopen(url) as response:
          html=response.read().decode("utf-8")

      parser=TableParser()
      parser.feed(html)

      dt=[]

      for row in parser.rows:
          if len(row)>=3:
              try:
                  x=int(row[0])
                  char=row[1]
                  y=int(row[2])
                  dt.append((x,y,char))
              except ValueError:
                  continue
              

      if not dt:
          print("No data found")
          return

      max_x=max(x for x,y,char in dt)   
      max_y=max(y for x,y,char in dt)

      grid=[[" " for _ in range(max_x+1)]for _ in range(max_y+1)]

      for x,y,char in dt:
          grid[y][x]=char

      for y in range(max_y,-1,-1):
          print("".join(grid[y]))

url="https://docs.google.com/document/d/e/2PACX-1vSvM5gDlNvt7npYHhp_XfsJvuntUhq184By5xO_pA4b_gCWeXb6dM6ZxwN8rE6S4ghUsCj2VKR21oEP/pub" 
decode_secret_msg(url)
   