/*
Room is a class that represents a rectangular room in a maze or dungeon. It has properties for the room's position (x and y coordinates) 
and its dimensions (width and height). The center method calculates and returns the coordinates of the center point of the room, 
which can be useful for placing objects or characters within the room. The class provides a simple structure 
for defining rooms in a procedural generation context, allowing for easy creation and manipulation of room objects in a maze or dungeon layout.
*/
export class Room {
  
  constructor(x, y, width, height) {
    
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  
  }

  center() {
    
    return {
      x: Math.floor(this.x + this.width / 2),
      y: Math.floor(this.y + this.height / 2)
    };
  }
}