import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as random from "@pulumi/random";
import { Netmask } from "netmask";

const config = new pulumi.Config();

export = async () => {

    // Create an Azure Resource Group
    const resourceGroup = new azure.core.ResourceGroup("resourceGroup");

    const cidrBlock = config.require("cidrBlock");
    const subnetMask = config.require("netmask");

    const virtualNetworkCidr = new Netmask(cidrBlock.toString());
    const subnetCidr = new Netmask(`${virtualNetworkCidr.base}/${subnetMask}`);

    const virtualNetwork = new azure.network.VirtualNetwork("network", {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        addressSpaces: [cidrBlock],
    });

    const subnet = new azure.network.Subnet("subnet", {
        resourceGroupName: resourceGroup.name,
        virtualNetworkName: virtualNetwork.name,
        addressPrefixes: [`${subnetCidr.base}/${subnetCidr.bitmask}`],
    });

    const pubIp = new azure.network.PublicIp("ip", {
        location: resourceGroup.location,
        resourceGroupName: resourceGroup.name,
        allocationMethod: "Static",
        sku: "Standard",
    });

    const nic = new azure.network.NetworkInterface("nic", {
        resourceGroupName: resourceGroup.name,
        ipConfigurations: [{
            name: "webserveripcfg",
            subnetId: subnet.id,
            privateIpAddressAllocation: "Dynamic",
            publicIpAddressId: pubIp.id,
        }],
    });

    const password = new random.RandomPassword('password', {
        length: 33,
        special: false,
    }).result;

    const vm = new azure.compute.VirtualMachine("vm", {
        resourceGroupName: resourceGroup.name,
        networkInterfaceIds: [nic.id],
        vmSize: "Standard_A0",
        deleteDataDisksOnTermination: true,
        deleteOsDiskOnTermination: true,
        osProfile: {
            computerName: "hostname",
            adminUsername: "pulumi",
            adminPassword: password,
            // customData: args.bootScript,
        },
        osProfileLinuxConfig: {
            disablePasswordAuthentication: false,
        },
        storageOsDisk: {
            createOption: "FromImage",
            name: "osdisk1",
        },
        storageImageReference: {
            publisher: "Canonical",
            offer: "0001-com-ubuntu-server-focal",
            sku: "20_04-lts",
            version: "latest",
        },
    });

    return {
        password: password,
        ip: pubIp.ipAddress,
    }

}
