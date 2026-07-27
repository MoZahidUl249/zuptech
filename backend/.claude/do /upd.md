first change and update the model according to this . Than 
change update  schame , logic , servises according to this change

model section {
    name : string 
    catagory[]
}

model catagory{
    name string  uinQue
     svglogo
    product[]
}

Model servises {
    name 
    dsc
    image string 
    servisefeture[](item)
}

update  serviseLead
servise id

model indristralServ {
    name 
    dsc
    image string 
    inServisefeture[](item)

}

add indristral Serv model